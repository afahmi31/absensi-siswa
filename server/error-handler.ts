import { defineNitroErrorHandler } from 'nitropack/runtime'
import { getRequestHeader, getRequestURL, send, setResponseHeaders, setResponseStatus } from 'h3'
import {
  safeErrorCopy,
  safeErrorData,
  safeErrorStatusCode,
  safeErrorStatusText,
  safeHtmlErrorPage,
  type SafeErrorRequest,
} from './utils/safe-error-response.ts'

export default defineNitroErrorHandler(async (error, event) => {
  const statusCode = safeErrorStatusCode(error)
  const request: SafeErrorRequest = {
    method: event.method,
    pathname: getRequestURL(event).pathname,
  }
  const statusMessage = safeErrorCopy(statusCode, error, request)

  if (statusCode >= 500) {
    console.error(JSON.stringify({ category: 'request_error', statusCode }))
  }

  const acceptsHtml = getRequestHeader(event, 'accept')?.includes('text/html') ?? false
  const headers = {
    'cache-control': 'no-store',
    'content-type': acceptsHtml ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'DENY',
    'referrer-policy': 'no-referrer',
    'content-security-policy': "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
  }

  if (event.node.res.headersSent) {
    event.node.res.end()
    return
  }

  setResponseHeaders(event, headers)
  setResponseStatus(event, statusCode, safeErrorStatusText(statusCode))

  if (acceptsHtml) {
    await send(event, safeHtmlErrorPage(statusCode, statusMessage))
    return
  }

  const body: Record<string, unknown> = {
    error: true,
    statusCode,
    statusMessage,
    message: statusMessage,
  }
  const data = safeErrorData(error, statusCode, request)
  if (data) body.data = data
  await send(event, JSON.stringify(body))
})
