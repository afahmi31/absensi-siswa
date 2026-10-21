import { constants } from 'node:fs'
import { lstat, realpath, mkdir, open, readdir, rm, rename } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID, createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

export const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const TEST_ROOT = path.join(APP_ROOT, '.cache', 'local-backup-tests')
export const BACKUP_ROOT = path.join(APP_ROOT, '.data', 'local-backups')
export const LIMITS = Object.freeze({ manifest: 1024 ** 2, dump: 256 * 1024 ** 2, sql: 256 * 1024 ** 2, logo: 2 * 1024 ** 2, assets: 256 * 1024 ** 2, assetCount: 10000 })
export const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')
export const fail = (code) => { throw new Error(`Local backup refused (${code}).`) }
const same = (a, b) => path.relative(a, b) === '' && path.relative(b, a) === ''
export function inside(root, target) {
  const relative = path.relative(root, target)
  return !!relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

export async function directory(target, create = false) {
  const resolved = path.resolve(target)
  if (resolved.startsWith('\\\\')) fail('UNC')
  const root = path.parse(resolved).root
  let current = root
  for (const part of path.relative(root, resolved).split(path.sep).filter(Boolean)) {
    current = path.join(current, part)
    let info = await lstat(current).catch((e) => e.code === 'ENOENT' ? null : Promise.reject(e))
    if (!info && create) {
      await mkdir(current).catch((e) => { if (e.code !== 'EEXIST') throw e })
      info = await lstat(current)
    }
    if (!info?.isDirectory() || info.isSymbolicLink() || !same(await realpath(current), current)) fail('directory')
  }
  return resolved
}

export function privateAcl(target) {
  if (process.platform !== 'win32') fail('Windows-ACL-required')
  const sid = execFileSync('whoami.exe', ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8', windowsHide: true }).match(/S-\d-\d+(?:-\d+)+/)?.[0]
  if (!sid) fail('SID')
  execFileSync('icacls.exe', [target, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`, '*S-1-5-18:(OI)(CI)F'], { stdio: 'ignore', windowsHide: true })
  // Verify effective explicit entries by SID; do not rely on localized icacls text.
  const script = `$ErrorActionPreference='Stop'; $a=Get-Acl -LiteralPath $env:LAB002_ACL_PATH; if(-not $a.AreAccessRulesProtected){exit 2}; $seen=@{}; foreach($r in $a.Access){$s=$r.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value; if($s -notin @('${sid}','S-1-5-18') -or $r.AccessControlType -ne 'Allow' -or $r.FileSystemRights -ne [System.Security.AccessControl.FileSystemRights]::FullControl){exit 3}; $seen[$s]=$true}; if(-not $seen['${sid}'] -or -not $seen['S-1-5-18']){exit 4}`
  try {
    // PowerShell 7 may export a module path incompatible with Windows PowerShell 5.
    // Let this child reconstruct its own system module path; no global settings change.
    const env = { ...process.env, LAB002_ACL_PATH: target }
    for (const name of Object.keys(env)) if (name.toLowerCase() === 'psmodulepath') delete env[name]
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { stdio: 'ignore', windowsHide: true, env, timeout: 10000 })
  } catch { fail('ACL-verification') }
}

const owned = new WeakMap()
export async function ownedDirectory(parent, prefix = 'run') {
  if (!inside(TEST_ROOT, parent) && !same(parent, TEST_ROOT) && !same(parent, BACKUP_ROOT)) fail('owned-parent')
  await directory(parent, true)
  const target = path.join(parent, `${prefix}-${randomUUID()}`)
  await mkdir(target)
  const info = await lstat(target)
  const receipt = Object.freeze({ path: target })
  owned.set(receipt, { parent, dev: info.dev, ino: info.ino })
  try { privateAcl(target) } catch (e) { await cleanup(receipt); throw e }
  return receipt
}
export async function verifyOwned(receipt) {
  const record = owned.get(receipt)
  if (!record || !inside(record.parent, receipt.path) || path.dirname(receipt.path) !== record.parent) fail('ownership')
  await directory(receipt.path)
  const info = await lstat(receipt.path)
  if (info.dev !== record.dev || info.ino !== record.ino) fail('ownership-changed')
  return record
}
export async function safeTree(target) {
  await directory(target)
  for (const entry of await readdir(target)) {
    const child = path.join(target, entry)
    const info = await lstat(child)
    if (info.isSymbolicLink() || !same(await realpath(child), child)) fail('tree-link')
    if (info.isDirectory()) await safeTree(child)
    else if (!info.isFile() || info.nlink !== 1) fail('tree-file')
  }
}
export async function cleanup(receipt) {
  await verifyOwned(receipt)
  await safeTree(receipt.path)
  await verifyOwned(receipt)
  await rm(receipt.path, { recursive: true, force: false })
  owned.delete(receipt)
}
export async function publish(receipt, id) {
  const record = await verifyOwned(receipt)
  if (!/^backup-\d{8}T\d{6}Z-[0-9a-f-]{36}$/.test(id)) fail('backup-ID')
  const final = path.join(record.parent, id)
  // Namespace lock serializes check+rename. Never remove a lock owned by another run.
  const lock = await open(path.join(record.parent, '.publish.lock'), 'wx', 0o600)
  const lockIdentity=await lock.stat()
  try {
    await directory(record.parent)
    if (await lstat(final).then(() => true, (e) => e.code === 'ENOENT' ? false : Promise.reject(e))) fail('backup-exists')
    await verifyOwned(receipt)
    await rename(receipt.path, final)
    owned.delete(receipt)
    return final
  } finally {
    await lock.close()
    const { unlink } = await import('node:fs/promises')
    const lockPath=path.join(record.parent,'.publish.lock')
    await directory(record.parent)
    const current=await lstat(lockPath)
    if (!current.isFile() || current.isSymbolicLink() || current.dev!==lockIdentity.dev || current.ino!==lockIdentity.ino) fail('publication-lock-ownership')
    await unlink(lockPath)
  }
}
export async function writePrivate(target, bytes) {
  await directory(path.dirname(target))
  const handle = await open(target, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600)
  try { await handle.writeFile(bytes); await handle.sync() } finally { await handle.close() }
}
export async function readPrivate(target, max) {
  await directory(path.dirname(target))
  const before = await lstat(target)
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > max || !same(await realpath(target), target)) fail('file')
  const handle = await open(target, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try {
    const info = await handle.stat()
    if (info.dev !== before.dev || info.ino !== before.ino || info.size !== before.size || info.nlink !== 1) fail('file-race')
    const bytes = await handle.readFile()
    const after = await lstat(target)
    if (bytes.length > max || after.dev !== info.dev || after.ino !== info.ino || after.size !== info.size) fail('file-race')
    return bytes
  } finally { await handle.close() }
}

// A small JSON grammar walk rejects duplicate keys before JSON.parse can discard them.
export function strictJson(bytes) {
  const source = bytes.toString('utf8')
  let offset = 0
  const ws = () => { while (/\s/.test(source[offset] ?? '') && offset < source.length) offset++ }
  function string() {
    const start = offset++
    while (offset < source.length) {
      if (source[offset] === '\\') { offset += 2; continue }
      if (source[offset++] === '"') return JSON.parse(source.slice(start, offset))
    }
    fail('JSON-string')
  }
  function value(depth = 0) {
    if (depth > 64) fail('JSON-depth')
    ws()
    if (source[offset] === '{') {
      offset++; ws(); const keys = new Set()
      if (source[offset] === '}') { offset++; return }
      while (true) {
        ws(); if (source[offset] !== '"') fail('JSON-key')
        const key = string(); if (keys.has(key)) fail('JSON-duplicate'); keys.add(key)
        ws(); if (source[offset++] !== ':') fail('JSON-colon'); value(depth + 1); ws()
        const next = source[offset++]; if (next === '}') return; if (next !== ',') fail('JSON-object')
      }
    }
    if (source[offset] === '[') {
      offset++; ws(); if (source[offset] === ']') { offset++; return }
      while (true) { value(depth + 1); ws(); const next = source[offset++]; if (next === ']') return; if (next !== ',') fail('JSON-array') }
    }
    if (source[offset] === '"') { string(); return }
    const match = source.slice(offset).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/)
    if (!match) fail('JSON-value'); offset += match[0].length
  }
  value(); ws(); if (offset !== source.length) fail('JSON-tail')
  try { return JSON.parse(source) } catch { fail('JSON') }
}
