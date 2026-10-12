import postgres from 'postgres'

let connection: postgres.Sql | undefined

/** Create the lazy, server-only database connection from Nuxt's private runtime config. */
export function getDatabase(): postgres.Sql {
  const { databaseUrl } = useRuntimeConfig()
  if (typeof databaseUrl !== 'string' || databaseUrl.length === 0) {
    throw new Error('Database is not configured.')
  }

  if (!connection) {
    connection = postgres(databaseUrl, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 5,
      connection: { application_name: 'lab002-website-absensi-siswa' },
    })
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
