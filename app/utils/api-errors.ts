interface ApiErrorShape {
  statusMessage?: unknown
  message?: unknown
  data?: unknown
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : null
}

export function getApiMessage(error: unknown, fallback: string): string {
  const outer = record(error)
  const response = record(outer?.data)
  const message = response?.statusMessage ?? response?.message
  return typeof message === 'string' && message ? message : fallback
}

export function getApiFieldErrors(error: unknown): Record<string, string> {
  const outer = record(error)
  const response = record(outer?.data)
  const responseData = record(response?.data)
  const candidate = responseData?.fieldErrors ?? response?.fieldErrors
  const fields = record(candidate)
  if (!fields) return {}
  return Object.fromEntries(Object.entries(fields).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
}
