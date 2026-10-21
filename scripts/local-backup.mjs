import { createBackup, managedSource, restoreTest } from './local-backup-core.mjs'

export function parseArguments(args) {
  if (args.length === 1 && args[0] === 'create') return { command: 'create' }
  if (args.length === 2 && args[0] === 'restore-test' && /^--backup=backup-\d{8}T\d{6}Z-[0-9a-f-]{36}$/.test(args[1])) return { command: 'restore-test', id: args[1].slice(9) }
  throw new Error('Gunakan create atau restore-test --backup=<ID cadangan>. Target dan path tambahan tidak diterima.')
}
export async function main(args = process.argv.slice(2)) {
  const parsed = parseArguments(args)
  if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Gunakan Node.js 24 untuk cadangan lokal.')
  const result = parsed.command === 'create' ? await createBackup(await managedSource()) : await restoreTest({ id: parsed.id })
  console.log(parsed.command === 'create' ? `Cadangan lengkap: ${result.id}; ${result.tables} tabel, ${result.assets} logo; ${result.durationMs} ms.` : `Uji pemulihan berhasil: ${result.tables} tabel, ${result.assets} logo; akun direset; target uji dibersihkan; ${result.durationMs} ms.`)
}
if (import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(() => {
    console.error('Operasi cadangan lokal gagal. Tidak ada hasil sukses yang diterbitkan. Periksa prasyarat, izin folder, dan paket cadangan; jangan menghapus folder lain.')
    process.exitCode = 1
  })
}
