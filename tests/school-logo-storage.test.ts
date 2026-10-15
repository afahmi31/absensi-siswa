import assert from 'node:assert/strict'
import { lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, symlink, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { afterEach, test } from 'node:test'
import { getLocalSchoolLogoStorage, LocalSchoolLogoStorage, SchoolLogoStorageError } from '../server/utils/school-logo-storage.ts'

const storageRoots: string[] = []

afterEach(async () => {
  await Promise.all(storageRoots.splice(0).map(removeGeneratedStorageRoot))
})

async function createStorage(): Promise<{ root: string; storage: LocalSchoolLogoStorage }> {
  const cacheRoot = path.join(process.cwd(), '.cache', 'tests')
  await mkdir(cacheRoot, { recursive: true })
  const root = await mkdtemp(path.join(cacheRoot, 'school-logo-storage-'))
  storageRoots.push(root)
  return { root, storage: new LocalSchoolLogoStorage(root) }
}

async function removeGeneratedStorageRoot(root: string): Promise<void> {
  const info = await lstat(root).catch((error) => error?.code === 'ENOENT' ? null : Promise.reject(error))
  if (!info) return
  if (!info.isDirectory() || info.isSymbolicLink() || !/^school-logo-storage-[A-Za-z0-9]+$/.test(path.basename(root))) {
    throw new Error('Refusing to remove an unexpected school logo storage test root.')
  }
  const resolved = await realpath(root)
  const parent = await realpath(path.join(process.cwd(), '.cache', 'tests'))
  if (path.dirname(resolved).toLowerCase() !== parent.toLowerCase() || resolved.toLowerCase() !== path.resolve(root).toLowerCase()) {
    throw new Error('Refusing to remove school logo test storage outside its cache directory.')
  }
  await rm(resolved, { recursive: true, force: false })
}

test('local school logo storage writes and reads opaque UUID assets byte for byte', async () => {
  const { storage } = await createStorage()
  const assetId = '2a9a9d79-863a-4cbd-a79f-84bd0618779b'
  const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff])

  await storage.write(assetId, 'image/png', bytes)

  assert.deepEqual(await storage.read(assetId, 'image/png'), bytes)
})

test('O_EXCL collision does not delete or alter a pre-existing asset', async () => {
  const { root, storage } = await createStorage()
  const assetId = 'b3eaa15d-05a1-4fdc-9d15-a0204c7ab4a9'
  const existing = Buffer.from('owned by the earlier upload')
  await writeFile(path.join(root, `${assetId}.png`), existing, { flag: 'wx' })

  await assert.rejects(
    storage.write(assetId, 'image/png', Buffer.from('new upload')),
    (error: unknown) => error instanceof SchoolLogoStorageError && error.kind === 'io',
  )
  assert.deepEqual(await readFile(path.join(root, `${assetId}.png`)), existing)
})

test('local storage refuses a symlinked path and leaves the external target untouched', async (t) => {
  const { root, storage } = await createStorage()
  const assetId = 'e6b63d93-8d49-49c4-85f3-77e420e81a02'
  const outside = path.join(root, 'outside.bin')
  const target = path.join(root, `${assetId}.png`)
  const bytes = Buffer.from('not an image and never to be changed')
  await writeFile(outside, bytes, { flag: 'wx' })
  try {
    await symlink(outside, target, 'file')
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && ['EPERM', 'EACCES'].includes(String(error.code))) {
      t.skip('This Windows account cannot create file symlinks.')
      return
    }
    throw error
  }

  await assert.rejects(
    storage.read(assetId, 'image/png'),
    (error: unknown) => error instanceof SchoolLogoStorageError && error.kind === 'unsafe',
  )
  await assert.rejects(storage.write(assetId, 'image/png', Buffer.from('replace')))
  assert.ok((await lstat(target)).isSymbolicLink())
  assert.deepEqual(await readFile(outside), bytes)
})

test('local storage never enables on Vercel, including Preview, even with local opt-in', () => {
  const previousNodeEnv = process.env.NODE_ENV
  const previousVercel = process.env.VERCEL
  const previousVercelEnv = process.env.VERCEL_ENV
  const previousOptIn = process.env.LAB002_SCHOOL_LOGO_LOCAL_STORAGE
  try {
    process.env.NODE_ENV = 'production'
    process.env.VERCEL = '1'
    delete process.env.VERCEL_ENV
    process.env.LAB002_SCHOOL_LOGO_LOCAL_STORAGE = '1'
    assert.equal(getLocalSchoolLogoStorage(), null)
    delete process.env.VERCEL
    process.env.VERCEL_ENV = 'preview'
    assert.equal(getLocalSchoolLogoStorage(), null)
  } finally {
    restoreEnvironment('NODE_ENV', previousNodeEnv)
    restoreEnvironment('VERCEL', previousVercel)
    restoreEnvironment('VERCEL_ENV', previousVercelEnv)
    restoreEnvironment('LAB002_SCHOOL_LOGO_LOCAL_STORAGE', previousOptIn)
  }
})

test('local storage rejects traversal IDs and a junctioned directory component', async () => {
  const { root, storage } = await createStorage()
  const external = await createStorage()
  const assetId = 'e708897c-73dd-423b-95e1-06102924ddbd'
  const link = path.join(root, 'linked-storage')
  await symlink(external.root, link, 'junction')
  const escaped = new LocalSchoolLogoStorage(path.join(link, 'nested'))
  await assert.rejects(escaped.write(assetId, 'image/png', Buffer.from('must not escape')))
  await assert.rejects(storage.write('../outside', 'image/png', Buffer.from('must not traverse')))
  assert.deepEqual(await readdir(external.root), [])
  await unlink(link)
})

function restoreEnvironment(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}
