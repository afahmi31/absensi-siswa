import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const migrationsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../server/database/migrations')

export async function listMigrationNames() {
  return (await readdir(migrationsDirectory))
    .filter((name) => /^\d{4}_[a-z0-9_]+\.up\.sql$/.test(name))
    .map((name) => name.replace(/\.up\.sql$/, ''))
    .sort()
}
