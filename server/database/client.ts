import postgres from 'postgres'

let connection: postgres.Sql | undefined

const supabaseProjectRef = 'jkiewjlohgmsujcwerpi'
const supabaseRuntimeRole = 'lab002_app'

/** Strip tolerated SSL mode hints so only the explicit TLS options control cloud verification. */
export function databaseConnectionUrl(mode: string, databaseUrl: string): string {
  let target: URL
  try {
    target = new URL(databaseUrl)
  } catch {
    throw new Error('Database configuration is invalid.')
  }

  if (mode !== 'supabase') return databaseUrl
  const params = [...target.searchParams.entries()]
  if (params.some(([name]) => name.toLowerCase() !== 'sslmode')) {
    throw new Error('Supabase database configuration is invalid.')
  }
  const sslMode = target.searchParams.get('sslmode')
  if (sslMode && !['require', 'verify-full'].includes(sslMode.toLowerCase())) {
    throw new Error('Supabase database configuration is invalid.')
  }
  target.search = ''
  return target.toString()
}

/** Validate the private DB settings before the first connection is opened. */
export function databaseConnectionOptions(mode: string, databaseUrl: string, caCertificate: string) {
  let target: URL
  try {
    target = new URL(databaseUrl)
  } catch {
    throw new Error('Database configuration is invalid.')
  }

  if (!['postgres:', 'postgresql:'].includes(target.protocol)) {
    throw new Error('Database configuration is invalid.')
  }

  if (mode === 'local') {
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname.toLowerCase())) {
      throw new Error('Local database mode only accepts a loopback PostgreSQL server.')
    }
    return {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 5,
      connection: { application_name: 'lab002-website-absensi-siswa' },
    }
  }

  if (mode !== 'supabase') throw new Error('Database mode is invalid.')
  if (
    !target.hostname.endsWith('.pooler.supabase.com')
    || target.port !== '5432'
    || target.pathname !== '/postgres'
    || target.username !== `${supabaseRuntimeRole}.${supabaseProjectRef}`
    || target.password.length === 0
    || !caCertificate.includes('-----BEGIN CERTIFICATE-----')
    || !caCertificate.includes('-----END CERTIFICATE-----')
  ) {
    throw new Error('Supabase database configuration is invalid.')
  }

  return {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 5,
    prepare: false,
    ssl: {
      ca: caCertificate,
      rejectUnauthorized: true,
      servername: target.hostname,
    },
    connection: { application_name: 'lab002-website-absensi-siswa' },
  }
}

/** Create the lazy, server-only database connection from Nuxt's private runtime config. */
export function getDatabase(): postgres.Sql {
  const { databaseUrl, databaseMode, databaseCa } = useRuntimeConfig()
  if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
    throw new Error('Database is not configured.')
  }

  if (!connection) {
    const mode = typeof databaseMode === 'string' ? databaseMode : 'local'
    const ca = typeof databaseCa === 'string' ? databaseCa : ''
    const safeUrl = databaseConnectionUrl(mode, databaseUrl)
    const options = databaseConnectionOptions(mode, databaseUrl, ca)
    connection = postgres(safeUrl, options as Parameters<typeof postgres>[1])
  }
  return connection
}

/** Close the pool for a clean server shutdown or isolated integration test. */
export async function closeDatabase(): Promise<void> {
  if (!connection) return
  const current = connection
  connection = undefined
  await current.end({ timeout: 3 })
}
