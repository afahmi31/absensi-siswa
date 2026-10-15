import { constants } from 'node:fs'
import { lstat, mkdir, open, realpath, unlink } from 'node:fs/promises'
import type { FileHandle } from 'node:fs/promises'
import path from 'node:path'

export type SchoolLogoMimeType = 'image/png' | 'image/jpeg'
export interface SchoolLogoStorageReceipt {
  readonly dev: number
  readonly ino: number
}

export class SchoolLogoStorageError extends Error {
  readonly kind: 'unavailable' | 'missing' | 'unsafe' | 'io'

  constructor(kind: 'unavailable' | 'missing' | 'unsafe' | 'io') {
    super('School logo storage operation failed.')
    this.name = 'SchoolLogoStorageError'
    this.kind = kind
  }
}

export function getLocalSchoolLogoStorage(): LocalSchoolLogoStorage | null {
  if (typeof process.env.VERCEL !== 'undefined' || typeof process.env.VERCEL_ENV !== 'undefined') return null
  const localEnabled = process.env.NODE_ENV === 'development'
    || process.env.LAB002_FIXTURE === '1'
    || process.env.LAB002_SCHOOL_LOGO_LOCAL_STORAGE === '1'
  if (!localEnabled) return null

  const configuredRoot = process.env.LAB002_SCHOOL_LOGO_ROOT
  const root = configuredRoot
    ? path.resolve(configuredRoot)
    : path.resolve(process.cwd(), '.data', 'uploads', 'school-logos')
  return new LocalSchoolLogoStorage(root)
}

export class LocalSchoolLogoStorage {
  private readonly root: string

  constructor(root: string) {
    this.root = root
  }

  async write(assetId: string, mimeType: SchoolLogoMimeType, bytes: Buffer): Promise<SchoolLogoStorageReceipt> {
    const filePath = await this.safeFilePath(assetId, mimeType, true)
    let handle: FileHandle | undefined
    let createdIdentity: { dev: number; ino: number } | undefined
    try {
      const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0)
      handle = await open(filePath, flags, 0o600)
      const createdStat = await handle.stat()
      createdIdentity = { dev: createdStat.dev, ino: createdStat.ino }
      await handle.writeFile(bytes)
      await handle.sync()
      await handle.close()
      handle = undefined
      await this.verifyExistingFile(filePath)
      return createdIdentity!
    } catch {
      await handle?.close().catch(() => undefined)
      if (createdIdentity) await this.unlinkCreatedFile(filePath, createdIdentity)
      throw new SchoolLogoStorageError('io')
    }
  }

  async read(assetId: string, mimeType: SchoolLogoMimeType): Promise<Buffer> {
    const filePath = await this.safeFilePath(assetId, mimeType, false)
    const flags = constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0)
    let handle
    try {
      handle = await open(filePath, flags)
      const info = await handle.stat()
      if (!info.isFile() || info.size < 1 || info.size > 2 * 1024 * 1024) {
        throw new SchoolLogoStorageError('unsafe')
      }
      await this.verifyExistingFile(filePath)
      return await handle.readFile()
    } catch (error) {
      if (error instanceof SchoolLogoStorageError) throw error
      if (isNotFound(error)) throw new SchoolLogoStorageError('missing')
      throw new SchoolLogoStorageError('io')
    } finally {
      await handle?.close().catch(() => undefined)
    }
  }

  async removeCreated(assetId: string, mimeType: SchoolLogoMimeType, receipt: SchoolLogoStorageReceipt): Promise<void> {
    const filePath = await this.safeFilePath(assetId, mimeType, false)
    await this.unlinkCreatedFile(filePath, receipt)
  }

  private async safeFilePath(assetId: string, mimeType: SchoolLogoMimeType, createRoot: boolean): Promise<string> {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(assetId)) {
      throw new SchoolLogoStorageError('unsafe')
    }
    const root = path.resolve(this.root)
    try {
      await verifyDirectoryPath(root, createRoot)
      const extension = mimeType === 'image/png' ? '.png' : '.jpg'
      const filePath = path.join(root, `${assetId}${extension}`)
      const relative = path.relative(root, filePath)
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw new SchoolLogoStorageError('unsafe')
      return filePath
    } catch (error) {
      if (error instanceof SchoolLogoStorageError) throw error
      if (isNotFound(error) && !createRoot) throw new SchoolLogoStorageError('missing')
      throw new SchoolLogoStorageError('unsafe')
    }
  }

  private async verifyExistingFile(filePath: string): Promise<void> {
    try {
      const info = await lstat(filePath)
      if (!info.isFile() || info.isSymbolicLink()) throw new SchoolLogoStorageError('unsafe')
      const resolvedRoot = await realpath(this.root)
      const resolvedFile = await realpath(filePath)
      if (!samePath(resolvedFile, filePath) || !isWithinRoot(resolvedRoot, resolvedFile)) {
        throw new SchoolLogoStorageError('unsafe')
      }
    } catch (error) {
      if (error instanceof SchoolLogoStorageError) throw error
      if (isNotFound(error)) throw new SchoolLogoStorageError('missing')
      throw new SchoolLogoStorageError('io')
    }
  }

  private async unlinkCreatedFile(filePath: string, identity: { dev: number; ino: number }): Promise<void> {
    try {
      const info = await lstat(filePath)
      if (!info.isFile() || info.isSymbolicLink() || info.dev !== identity.dev || info.ino !== identity.ino) return
      await this.verifyExistingFile(filePath)
      await unlink(filePath)
    } catch {
      // Cleanup is best effort and must never remove a target that is no longer ours.
    }
  }
}

async function verifyDirectoryPath(directory: string, create: boolean): Promise<void> {
  const parsed = path.parse(directory)
  let current = parsed.root
  const segments = path.relative(parsed.root, directory).split(path.sep).filter(Boolean)
  for (const segment of segments) {
    current = path.join(current, segment)
    let info = await lstat(current).catch((error) => isNotFound(error) ? null : Promise.reject(error))
    if (!info && create) {
      await mkdir(current).catch((error) => {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      })
      info = await lstat(current)
    }
    if (!info) throw new SchoolLogoStorageError('missing')
    if (!info.isDirectory() || info.isSymbolicLink()) throw new SchoolLogoStorageError('unsafe')
    if (!samePath(await realpath(current), current)) throw new SchoolLogoStorageError('unsafe')
  }
}

function samePath(left: string, right: string): boolean {
  return path.relative(path.resolve(left), path.resolve(right)) === ''
    && path.relative(path.resolve(right), path.resolve(left)) === ''
}

function isWithinRoot(root: string, filePath: string): boolean {
  const relative = path.relative(root, filePath)
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT'
}
