import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const migrationsDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations')

async function migrations() {
  const names = (await readdir(migrationsDirectory))
    .filter((name) => /^\d{4}_[a-z0-9_]+\.up\.sql$/.test(name))
    .sort()
  return Promise.all(names.map(async (upName) => {
    const downName = upName.replace(/\.up\.sql$/, '.down.sql')
    const upPath = path.join(migrationsDirectory, upName)
    const downPath = path.join(migrationsDirectory, downName)
    const [upSql, downSql] = await Promise.all([readFile(upPath, 'utf8'), readFile(downPath, 'utf8')])
    return {
      name: upName.replace(/\.up\.sql$/, ''),
      upSql,
      downSql,
      checksum: createHash('sha256').update(upSql).update('\0').update(downSql).digest('hex'),
    }
  }))
}

export async function runMigrations(database, direction = 'up') {
  if (direction !== 'up' && direction !== 'down') throw new Error('Migration direction must be up or down.')
  const list = await migrations()
  const ordered = direction === 'up' ? list : [...list].reverse()
  const results = []

  for (const migration of ordered) {
    const applied = await database.begin(async (transaction) => {
      await transaction`select pg_advisory_xact_lock(1710, 1)`
      const ledger = await transaction`select to_regclass('public.schema_migrations') is not null as exists`
      if (!ledger[0]?.exists) {
        await transaction`
          create table public.schema_migrations (
          name text primary key,
          checksum text not null,
          applied_at timestamptz not null default clock_timestamp()
          )
        `
      }
      const rows = await transaction`
        select checksum from public.schema_migrations where name = ${migration.name}
      `
      const current = rows[0]?.checksum

      if (direction === 'up') {
        if (current) {
          if (current !== migration.checksum) throw new Error(`Applied migration ${migration.name} has a different checksum.`)
          return false
        }
        await transaction.unsafe(migration.upSql).simple()
        await transaction`
          insert into public.schema_migrations (name, checksum) values (${migration.name}, ${migration.checksum})
        `
        return true
      }

      if (!current) return false
      if (current !== migration.checksum) throw new Error(`Applied migration ${migration.name} has a different checksum.`)
      await transaction.unsafe(migration.downSql).simple()
      await transaction`delete from public.schema_migrations where name = ${migration.name}`
      return true
    })
    results.push({ name: migration.name, applied })
  }

  return results
}
