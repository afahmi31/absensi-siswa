import Busboy from 'busboy'
import { createHash } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import { Writable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import sharp from 'sharp'
import type { H3Event } from 'h3'
import { isJsonRecord } from './study-api.ts'
import type { SchoolLogoMimeType } from './school-logo-storage.ts'

export const SCHOOL_LOGO_MAX_BYTES = 2 * 1024 * 1024
export const SCHOOL_LOGO_MAX_PIXELS = 4096 * 4096
export const SCHOOL_LOGO_MAX_REQUEST_BYTES = SCHOOL_LOGO_MAX_BYTES + 64 * 1024
const metadataFieldMaxBytes = 2 * 1024
const fileFieldName = 'logo'
const metadataFieldName = 'metadata'

export interface UploadedSchoolLogo {
  bytes: Buffer
  mimeType: string
}

export interface SchoolSaveBody {
  metadata: Record<string, unknown>
  isMultipart: boolean
  logo?: UploadedSchoolLogo
}

export interface ValidatedSchoolLogo {
  bytes: Buffer
  mimeType: SchoolLogoMimeType
  width: number
  height: number
  sha256: string
}

interface ParsedMultipart {
  metadataText: string | null
  logo: UploadedSchoolLogo | null
}

export async function readSchoolSaveBody(event: H3Event): Promise<SchoolSaveBody> {
  const contentType = getRequestHeader(event, 'content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType === 'application/json') {
    const bytes = await readBoundedJsonRequest(event, event.node.req)
    let metadata: unknown
    try {
      metadata = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
    } catch {
      throw createError({ statusCode: 400, statusMessage: 'Data formulir tidak dapat dibaca. Coba kirim kembali.' })
    }
    if (!isJsonRecord(metadata)) {
      throw createError({ statusCode: 400, statusMessage: 'Data formulir tidak dapat dibaca. Coba kirim kembali.' })
    }
    return { metadata, isMultipart: false }
  }
  if (contentType !== 'multipart/form-data') {
    throw createError({ statusCode: 415, statusMessage: 'Format data formulir tidak didukung.' })
  }

  const parsed = await readSchoolMultipart(event, event.node.req)
  if (parsed.metadataText === null) {
    throw createError({ statusCode: 400, statusMessage: 'Data formulir tidak dapat dibaca. Coba kirim kembali.' })
  }
  let metadata: unknown
  try {
    metadata = JSON.parse(parsed.metadataText)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'Data formulir tidak dapat dibaca. Coba kirim kembali.' })
  }
  if (!isJsonRecord(metadata)) {
    throw createError({ statusCode: 400, statusMessage: 'Data formulir tidak dapat dibaca. Coba kirim kembali.' })
  }
  return { metadata, isMultipart: true, ...(parsed.logo ? { logo: parsed.logo } : {}) }
}

async function readBoundedJsonRequest(event: H3Event, request: IncomingMessage): Promise<Buffer> {
  const contentLength = request.headers['content-length']
  if (typeof contentLength === 'string' && /^\d+$/.test(contentLength) && Number(contentLength) > SCHOOL_LOGO_MAX_REQUEST_BYTES) {
    setResponseHeader(event, 'connection', 'close')
    request.pause()
    throw tooLarge()
  }

  return await new Promise<Buffer>((resolve, reject) => {
    let byteCount = 0
    let settled = false
    const chunks: Buffer[] = []
    const limit = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        byteCount += chunk.length
        if (byteCount > SCHOOL_LOGO_MAX_REQUEST_BYTES) callback(tooLarge())
        else callback(null, chunk)
      },
    })
    const finish = (error?: Error) => {
      if (settled) return
      settled = true
      request.removeListener('aborted', onAbort)
      request.removeListener('error', onRequestError)
      if (error) {
        setResponseHeader(event, 'connection', 'close')
        request.unpipe(limit)
        request.pause()
        reject(error)
      } else {
        resolve(Buffer.concat(chunks, byteCount))
      }
    }
    const onAbort = () => finish(createError({ statusCode: 400, statusMessage: 'Data formulir tidak dapat dibaca. Coba kirim kembali.' }))
    const onRequestError = () => finish(createError({ statusCode: 400, statusMessage: 'Data formulir tidak dapat dibaca. Coba kirim kembali.' }))

    request.once('aborted', onAbort)
    request.once('error', onRequestError)
    limit.on('data', (chunk: Buffer) => chunks.push(chunk))
    limit.once('error', (error) => finish(error instanceof Error && getStatusCode(error) === 413
      ? error
      : createError({ statusCode: 400, statusMessage: 'Data formulir tidak dapat dibaca. Coba kirim kembali.' })))
    limit.once('end', () => finish())
    request.pipe(limit)
  })
}

export async function validateSchoolLogo(upload: UploadedSchoolLogo): Promise<ValidatedSchoolLogo> {
  const bytes = upload.bytes
  if (bytes.length < 8 || bytes.length > SCHOOL_LOGO_MAX_BYTES) throw invalidLogo()

  const mimeType = sniffMimeType(bytes)
  if (!mimeType || upload.mimeType !== mimeType) throw invalidLogo()

  const options = {
    failOn: 'warning' as const,
    limitInputPixels: SCHOOL_LOGO_MAX_PIXELS,
    unlimited: false,
    pages: 1,
    animated: false,
    sequentialRead: true,
  }
  let metadata
  try {
    metadata = await sharp(bytes, options).metadata()
    if (
      metadata.format !== (mimeType === 'image/png' ? 'png' : 'jpeg')
      || !Number.isInteger(metadata.width) || !Number.isInteger(metadata.height)
      || !metadata.width || !metadata.height
      || metadata.width > 4096 || metadata.height > 4096
      || metadata.width * metadata.height > SCHOOL_LOGO_MAX_PIXELS
      || (metadata.pages !== undefined && metadata.pages !== 1)
    ) throw new Error('Unsupported school logo dimensions or format.')

    const decoder = sharp(bytes, options).raw()
    const discardDecodedPixels = new Writable({ write(_chunk, _encoding, callback) { callback() } })
    await pipeline(decoder, discardDecodedPixels)
  } catch {
    throw invalidLogo()
  }

  return {
    bytes,
    mimeType,
    width: metadata.width!,
    height: metadata.height!,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  }
}

async function readSchoolMultipart(event: H3Event, request: IncomingMessage): Promise<ParsedMultipart> {
  const contentLength = request.headers['content-length']
  if (typeof contentLength === 'string' && /^\d+$/.test(contentLength) && Number(contentLength) > SCHOOL_LOGO_MAX_REQUEST_BYTES) {
    setResponseHeader(event, 'connection', 'close')
    request.pause()
    throw tooLarge()
  }

  return await new Promise<ParsedMultipart>((resolve, reject) => {
    let bodyBytes = 0
    let metadataText: string | null = null
    let logo: UploadedSchoolLogo | null = null
    let fileCount = 0
    let fieldCount = 0
    let partCount = 0
    let failure: Error | null = null
    let settled = false
    let parser: ReturnType<typeof Busboy>

    const rejectNow = (error: Error) => {
      if (settled) return
      settled = true
      setResponseHeader(event, 'connection', 'close')
      request.unpipe(byteLimit)
      byteLimit.unpipe(parser)
      request.pause()
      parser.destroy()
      reject(error)
    }

    const byteLimit = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        bodyBytes += chunk.length
        if (bodyBytes > SCHOOL_LOGO_MAX_REQUEST_BYTES) callback(tooLarge())
        else callback(null, chunk)
      },
    })

    try {
      parser = Busboy({
        headers: request.headers,
        preservePath: false,
        limits: {
          fileSize: SCHOOL_LOGO_MAX_BYTES + 1,
          files: 2,
          fields: 2,
          parts: 3,
          fieldSize: metadataFieldMaxBytes + 1,
          fieldNameSize: 32,
          headerPairs: 16,
        },
      })
    } catch {
      setResponseHeader(event, 'connection', 'close')
      request.pause()
      reject(createError({ statusCode: 400, statusMessage: 'Data formulir tidak dapat dibaca. Coba kirim kembali.' }))
      return
    }

    const onAbort = () => rejectNow(createError({ statusCode: 400, statusMessage: 'Data formulir tidak dapat dibaca. Coba kirim kembali.' }))
    const onRequestError = () => rejectNow(createError({ statusCode: 400, statusMessage: 'Data formulir tidak dapat dibaca. Coba kirim kembali.' }))
    request.once('aborted', onAbort)
    request.once('error', onRequestError)

    byteLimit.once('error', (error) => {
      rejectNow(error instanceof Error && getStatusCode(error) === 413
        ? error
        : createError({ statusCode: 400, statusMessage: 'Data formulir tidak dapat dibaca. Coba kirim kembali.' }))
    })
    parser.once('error', () => rejectNow(createError({ statusCode: 400, statusMessage: 'Data formulir tidak dapat dibaca. Coba kirim kembali.' })))
    parser.on('filesLimit', () => { failure ??= invalidMultipart() })
    parser.on('fieldsLimit', () => { failure ??= invalidMultipart() })
    parser.on('partsLimit', () => { failure ??= invalidMultipart() })

    parser.on('field', (name, value, info) => {
      partCount += 1
      fieldCount += 1
      if (partCount > 2 || fieldCount > 1 || name !== metadataFieldName || name.length > 32 || info.valueTruncated || Buffer.byteLength(value, 'utf8') > metadataFieldMaxBytes) {
        failure ??= invalidMultipart()
        return
      }
      metadataText = value
    })

    parser.on('file', (name, stream, info) => {
      partCount += 1
      fileCount += 1
      const accepted = partCount <= 2 && fileCount === 1 && name === fileFieldName && name.length <= 32
      if (!accepted) failure ??= invalidMultipart()
      const chunks: Buffer[] = []
      let fileBytes = 0
      let truncated = false
      stream.on('limit', () => { truncated = true })
      stream.on('error', () => rejectNow(createError({ statusCode: 400, statusMessage: 'Data formulir tidak dapat dibaca. Coba kirim kembali.' })))
      stream.on('data', (chunk: Buffer) => {
        fileBytes += chunk.length
        if (fileBytes <= SCHOOL_LOGO_MAX_BYTES + 1) chunks.push(chunk)
      })
      stream.on('end', () => {
        if (truncated || stream.truncated || fileBytes > SCHOOL_LOGO_MAX_BYTES) {
          failure ??= tooLarge()
          return
        }
        if (accepted) logo = { bytes: Buffer.concat(chunks, fileBytes), mimeType: info.mimeType }
      })
      if (!accepted) stream.resume()
    })

    parser.once('close', () => {
      if (settled) return
      settled = true
      request.removeListener('aborted', onAbort)
      request.removeListener('error', onRequestError)
      if (failure) reject(failure)
      else resolve({ metadataText, logo })
    })

    request.pipe(byteLimit).pipe(parser)
  })
}

function tooLarge(): Error {
  return createError({ statusCode: 413, statusMessage: 'Ukuran logo atau formulir terlalu besar. Maksimal logo 2 MB.' })
}

function getStatusCode(error: Error): number | null {
  return 'statusCode' in error && Number.isInteger(Number(error.statusCode)) ? Number(error.statusCode) : null
}

function invalidMultipart(): Error {
  return createError({ statusCode: 422, statusMessage: 'Data formulir logo tidak valid. Periksa kembali berkas lalu coba lagi.' })
}

function invalidLogo(): never {
  throw createError({
    statusCode: 422,
    statusMessage: 'Pilih logo PNG atau JPEG yang valid, maksimal 2 MB dan 4096 × 4096 piksel.',
    data: { fieldErrors: { logo: 'Format atau ukuran logo tidak sesuai.' } },
  })
}

function sniffMimeType(bytes: Buffer): SchoolLogoMimeType | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  return null
}
