import { lstat, realpath, open } from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import { directory, readPrivate, sha256, fail } from './local-backup-files.mjs'
import { PG_BIN, pgTool, runChild, childEnvironment } from './local-backup-postgres.mjs'

const powershell = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe'
const executable = path.join(PG_BIN, 'postgres.exe')
const receipts = new WeakMap()
const samePath = (left, right) => typeof left === 'string' && typeof right === 'string' && path.relative(left, right) === '' && path.relative(right, left) === ''
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right)
const positive = (value) => Number.isSafeInteger(value) && value > 0 && value <= 0xffffffff
const identity = (info) => ({ dev: info.dev, ino: info.ino })
const trustedBinaries = [executable, path.join(PG_BIN,'pg_ctl.exe'), path.join(PG_BIN,'pg_dump.exe'), powershell]
function processTicks(value) {
  const match=value.match(/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)\.(\d{7})Z$/)
  if(!match||!Number.isFinite(Date.parse(`${match[1]}Z`)))fail('identity-process-time')
  return BigInt(Date.parse(`${match[1]}Z`))*10000n+BigInt(match[2])
}
const sqlTicks=(value)=>{const [seconds,fraction]=value.split('.');return BigInt(seconds)*10000000n+BigInt(fraction.padEnd(7,'0'))}

/** Fixed executable reader: Windows servicing hardlinks are not backup inputs. */
export async function readTrustedBinary(file) {
  if (!trustedBinaries.includes(file)) fail('identity-binary-allowlist')
  await directory(path.dirname(file))
  const before=await lstat(file)
  const allowedLinks=file===powershell?[1,2]:[1]
  if(!before.isFile()||before.isSymbolicLink()||!allowedLinks.includes(before.nlink)||before.size<1||before.size>64*1024**2||!samePath(await realpath(file),file))fail('identity-binary')
  const handle=await open(file,constants.O_RDONLY|(constants.O_NOFOLLOW??0))
  try{
    const info=await handle.stat()
    if(!equal({...identity(info),size:info.size,nlink:info.nlink},{...identity(before),size:before.size,nlink:before.nlink}))fail('identity-binary-race')
    const bytes=await handle.readFile()
    const after=await lstat(file)
    if(bytes.length!==info.size||!equal({...identity(after),size:after.size,nlink:after.nlink},{...identity(info),size:info.size,nlink:info.nlink})||!samePath(await realpath(file),file))fail('identity-binary-race')
    return {path:file,...identity(info),nlink:info.nlink,size:info.size,hash:sha256(bytes)}
  }finally{await handle.close()}
}

export function assertSameIdentity(baseline,current) {
  if(!equal(baseline,current))fail('identity-instance-changed')
}

/** Windows quote/backslash rules; no shell expansion and no tolerance for partial quotes. */
export function windowsArguments(command) {
  if (typeof command !== 'string' || !command.length || command.length > 32768 || /[\0\r\n]/.test(command) || /^\s/.test(command)) fail('identity-argv')
  const result = []; let index = 0
  while (index < command.length) {
    while (/\s/.test(command[index] ?? '') && index < command.length) index++
    if (index === command.length) break
    let argument = '', quoted = false
    while (index < command.length && (quoted || !/\s/.test(command[index]))) {
      let slashes = 0
      while (command[index] === '\\') { slashes++; index++ }
      if (command[index] === '"') {
        argument += '\\'.repeat(Math.floor(slashes / 2))
        if (slashes % 2) argument += '"'
        else quoted = !quoted
        index++
      } else {
        argument += '\\'.repeat(slashes)
        if (index < command.length && (quoted || !/\s/.test(command[index]))) argument += command[index++]
      }
    }
    if (quoted || !argument.length) fail('identity-argv')
    result.push(argument)
  }
  return result
}

export function parsePostmaster(bytes, expected) {
  const lines = bytes.toString('utf8').split(/\r?\n/)
  if (lines.at(-1) === '') lines.pop()
  if (lines.length !== 8 || !/^[1-9]\d*$/.test(lines[0]) || !/^[1-9]\d*$/.test(lines[2]) || !/^[1-9]\d*$/.test(lines[3])) fail('identity-PID-format')
  const value = { pid: Number(lines[0]), root: lines[1], epoch: Number(lines[2]), port: Number(lines[3]) }
  if (!positive(value.pid) || !Number.isSafeInteger(value.epoch) || !samePath(value.root, expected.root) || value.port !== expected.port || lines[5] !== '127.0.0.1' || lines[7].trim() !== 'ready') fail('identity-PID')
  return value
}

function commandMatches(command, expected) {
  const args = windowsArguments(command)
  if (!samePath(args[0], executable) || args[1] !== '-D' || !path.isAbsolute(args[2] ?? '') || !samePath(args[2], expected.root)) fail('identity-command')
  if (expected.fixtureConfig) {
    if (args.length !== 5 || args[3] !== '-c' || !args[4].startsWith('config_file=') || !samePath(args[4].slice(12), expected.fixtureConfig)) fail('identity-command-config')
  } else if (args.length !== 3) fail('identity-command-extra')
}

/** Pure validator also used by synthetic negative tests. All fields are required. */
export function validateIdentitySnapshot(snapshot, expected) {
  const { files, sql, os, statusPid } = snapshot
  if (!files || !sql || !os || !Array.isArray(os.processes) || !Array.isArray(os.sockets)) fail('identity-fields')
  if (files.version !== '16' || !positive(files.pid.pid) || !samePath(files.pid.root, expected.root) || files.pid.port !== expected.port || statusPid !== files.pid.pid) fail('identity-files')
  if (sql.database !== expected.database || sql.role !== expected.role || sql.session_role !== expected.role || sql.owner !== (expected.owner ?? expected.role) || sql.host !== '127.0.0.1' || sql.client_host !== '127.0.0.1' || sql.port !== expected.port || Math.floor(sql.version / 10000) !== 16 || !positive(sql.backend) || !positive(sql.client_port) || sql.client_port > 65535) fail('identity-SQL')
  if (typeof sql.started !== 'string' || !/^\d+\.\d{1,6}$/.test(sql.started) || !Number.isSafeInteger(files.pid.epoch) || files.pid.epoch > Number(sql.started) || sql.read_only !== 'on') fail('identity-start')
  if (os.processes.length !== 2 || new Set(os.processes.map((p) => p.pid)).size !== 2) fail('identity-processes')
  const main = os.processes.find((p) => p.pid === files.pid.pid)
  const backend = os.processes.find((p) => p.pid === sql.backend)
  for (const process of [main, backend]) {
    if (!process || !samePath(process.exe, executable) || typeof process.created !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{7}Z$/.test(process.created) || !Number.isFinite(Date.parse(process.created))) fail('identity-process')
  }
  commandMatches(main.command, expected)
  // PG16 writes coarse MyStartTime to the PID file earlier than PgStartTime.
  // Only the PID timestamp has one-second uncertainty; pin all exact values.
  if (processTicks(main.created) >= (BigInt(files.pid.epoch) + 1n) * 10000000n || processTicks(main.created)>sqlTicks(sql.started) || sqlTicks(sql.started)>processTicks(backend.created)) fail('identity-start-order')
  const backendArgs = windowsArguments(backend.command)
  if (!samePath(backendArgs[0], executable) || backendArgs.length !== 3 || backendArgs[1] !== '--forkbackend' || !/^\d+$/.test(backendArgs[2]) || backend.parent !== main.pid || processTicks(backend.created) < processTicks(main.created)) fail('identity-backend-parent')
  const listeners = os.sockets.filter((socket) => socket.state === 'Listen')
  if (listeners.length !== 1 || listeners[0].local !== '127.0.0.1' || listeners[0].port !== expected.port || listeners[0].owner !== main.pid) fail('identity-listener')
  const connections = os.sockets.filter((socket) => socket.state === 'Established' && socket.local === sql.host && socket.port === sql.port && socket.remote === sql.client_host && socket.remotePort === sql.client_port)
  if (connections.length !== 1 || connections[0].owner !== main.pid) fail('identity-session-socket')
  return {
    files,
    statusPid,
    main: { pid: main.pid, created: main.created, exe: main.exe, command: main.command },
    backend: { pid: backend.pid, parent: backend.parent, created: backend.created, exe: backend.exe, command: backend.command },
    sql,
    listener: listeners[0],
    connection: connections[0],
  }
}

async function filesystemSnapshot(expected) {
  await directory(expected.root)
  const root = identity(await lstat(expected.root))
  const version = (await readPrivate(path.join(expected.root, 'PG_VERSION'), 16)).toString().trim()
  const pidPath = path.join(expected.root, 'postmaster.pid')
  const bytes = await readPrivate(pidPath, 4096)
  const pidInfo = identity(await lstat(pidPath))
  const binaries = []
  for (const file of trustedBinaries) binaries.push(await readTrustedBinary(file))
  return { root, version, pid: parsePostmaster(bytes, expected), pidIdentity: pidInfo, pidHash: sha256(bytes), binaries }
}

async function sqlSnapshot(tx) {
  const [row] = await tx`select current_database() as database,current_user as role,session_user as session_role,current_setting('transaction_read_only') as read_only,current_setting('server_version_num')::int as version,host(inet_server_addr()) as host,inet_server_port() as port,host(inet_client_addr()) as client_host,inet_client_port() as client_port,pg_backend_pid() as backend,extract(epoch from pg_postmaster_start_time())::text as started,(select rolname from pg_roles where oid=(select datdba from pg_database where datname=current_database())) as owner`
  return { ...row }
}

async function operatingSystemSnapshot(mainPid, backendPid, port, signal) {
  if (![mainPid, backendPid, port].every(positive) || port > 65535) fail('identity-OS-input')
  // Only known candidate PIDs and the fixed operation port. No arbitrary text interpolation.
  const script = `$ErrorActionPreference='Stop'; $procs=@(foreach($processIdValue in @(${mainPid},${backendPid})){Get-CimInstance -ClassName Win32_Process -Filter ('ProcessId='+[uint32]$processIdValue) -ErrorAction Stop | ForEach-Object {[pscustomobject]@{pid=[int]$_.ProcessId;parent=[int]$_.ParentProcessId;exe=$_.ExecutablePath;command=$_.CommandLine;created=$_.CreationDate.ToUniversalTime().ToString('o')}}}); $rows=@(Get-NetTCPConnection -LocalPort ${port} -ErrorAction Stop | Where-Object {$_.State -in @('Listen','Established')} | ForEach-Object {[pscustomobject]@{local=$_.LocalAddress;port=[int]$_.LocalPort;remote=$_.RemoteAddress;remotePort=[int]$_.RemotePort;state=$_.State.ToString();owner=[int]$_.OwningProcess}}); [pscustomobject]@{processes=$procs;sockets=$rows}|ConvertTo-Json -Depth 5 -Compress`
  const env = childEnvironment()
  for (const key of Object.keys(env)) if (key.toLowerCase() === 'psmodulepath') delete env[key]
  try {
    const output = await runChild(powershell, ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { env, timeout: 15000, max: 32768, signal })
    return JSON.parse(output.toString())
  } catch { fail('identity-OS-unavailable') }
}

async function capture(tx, expected, signal) {
  if (signal?.aborted) fail('identity-cancelled')
  const files = await filesystemSnapshot(expected)
  const status = (await pgTool('pg_ctl', ['-D', expected.root, 'status'], { timeout: 5000, max: 32768, signal })).toString()
  const match = status.match(/^pg_ctl: server is running \(PID: ([1-9]\d*)\)\r?\n/)
  if (!match) fail('identity-status')
  const sql = await sqlSnapshot(tx)
  const os = await operatingSystemSnapshot(files.pid.pid, sql.backend, expected.port, signal)
  const again = await sqlSnapshot(tx)
  const filesAgain = await filesystemSnapshot(expected)
  if (!equal(sql, again) || !equal(files, filesAgain)) fail('identity-during-query-change')
  return validateIdentitySnapshot({ files, sql, os, statusPid: Number(match[1]) }, expected)
}

export async function beginManagedIdentity(tx, expected, signal) {
  const settings = Object.freeze({ ...expected })
  if (!path.isAbsolute(settings.root) || !Number.isInteger(settings.port) || settings.port < 1 || settings.port > 65535 || !/^[a-z_][a-z0-9_]*$/.test(settings.role) || !/^[a-z_][a-z0-9_]*$/.test(settings.database)) fail('identity-policy')
  const baseline = await capture(tx, settings, signal)
  const receipt = Object.freeze({})
  receipts.set(receipt, { expected: settings, baseline, tx })
  return receipt
}

export async function verifyManagedIdentity(receipt, tx, signal) {
  const state = receipts.get(receipt)
  if (!state || state.tx !== tx) fail('identity-receipt')
  assertSameIdentity(state.baseline,await capture(tx,state.expected,signal))
}
