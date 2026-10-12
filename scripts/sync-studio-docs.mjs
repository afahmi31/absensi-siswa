import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const appRoot = fileURLToPath(new URL('../', import.meta.url))
const registry = path.resolve(appRoot, '..')
const studio = path.resolve(registry, '../..')
const destination = path.join(appRoot, 'docs/studio')
const sources = [
  ['AGENTS.md', 'governance/instructions.md'],
  ...['pm-executor-handoff-protocol-v1.0', 'studio-workflow', 'workflow-decisions',
    'user-facing-copy', 'git-and-environments', 'vibe-coding-from-project-docs']
    .map(name => [`docs/${name}.md`, `governance/${name}.md`]),
  ['products/PROD-002-product-prd-v1.md', 'product/PROD-002-product-prd-v1.md'],
  ['products/PROD-002-website-absensi-siswa.md', 'product/PROD-002-website-absensi-siswa.md'],
  ...['README', 'development-plan-v1', 'tasks', 'decisions-and-confirmations',
    'verification-plan', 'product-to-pm-handoff', 'stack-vercel-comparison']
    .map(name => [`Labs/LAB-002-website-absensi-siswa/${name}.md`, `project/${name}.md`]),
  ...['LAB002-SET-001', 'LAB002-SET-001-assignment', 'LAB002-UI-001', 'LAB002-UI-001-assignment']
    .map(name => [`Labs/LAB-002-website-absensi-siswa/tasks/${name}.md`, `project/tasks/${name}.md`]),
  ['Labs/LAB-002-website-absensi-siswa/reports/LAB002-UI-001-pm-review.md', 'project/reports/LAB002-UI-001-pm-review.md'],
  ['Labs/LAB-002-website-absensi-siswa/reports/LAB002-UI-001-design-report.md', 'project/reports/LAB002-UI-001-design-report.md'],
  ['Labs/LAB-002-website-absensi-siswa/design/LAB002-UI-001/README.md', 'project/design/LAB002-UI-001/README.md'],
  ['Labs/LAB-002-website-absensi-siswa/design/LAB002-UI-001/artifact-inventory.json', 'project/design/LAB002-UI-001/artifact-inventory.json'],
]
for (const name of await readdir(path.join(registry, 'design/LAB002-UI-001'))) {
  if (/\.(png|svg)$/.test(name)) sources.push([
    `Labs/LAB-002-website-absensi-siswa/design/LAB002-UI-001/${name}`,
    `project/design/LAB002-UI-001/${name}`,
  ])
}
const mapped = new Map(sources.map(([source, target]) => [path.resolve(studio, source).toLowerCase(), target]))
const hash = content => createHash('sha256').update(content).digest('hex')
const entries = []
for (const [source, target] of sources) {
  const sourcePath = path.resolve(studio, source)
  const targetPath = path.join(destination, target)
  const original = await readFile(sourcePath)
  let content = original
  if (source.endsWith('.md')) {
    content = Buffer.from(original.toString('utf8').replace(/(\[[^\]]*\]\()(<[^>]+>|[^)]+)(\))/g,
      (match, start, link, end) => {
        const href = link.replace(/^<|>$/g, '')
        if (/^(https?:|app:|codex:|#)/i.test(href)) return match
        const [file, fragment] = href.split('#')
        const resolved = path.resolve(path.dirname(sourcePath), file)
        const copied = mapped.get(resolved.toLowerCase())
        const adjusted = copied
          ? path.relative(path.dirname(targetPath), path.join(destination, copied)).replaceAll('\\', '/')
          : resolved.replaceAll('\\', '/')
        return `${start}<${adjusted}${fragment ? `#${fragment}` : ''}>${end}`
      }))
  }
  await mkdir(path.dirname(targetPath), { recursive: true })
  await writeFile(targetPath, content)
  entries.push({ source: sourcePath, copy: `docs/studio/${target}`, sourceSha256: hash(original), copySha256: hash(content) })
}
await writeFile(path.join(destination, 'manifest.json'), JSON.stringify({
  copiedAt: new Date().toISOString(), task: 'LAB002-SET-001',
  authority: 'Registry studio tetap sumber keputusan aktif. Salinan ini untuk penelusuran development.',
  transformations: 'Isi requirement dipertahankan. Link ke berkas terpilih memakai path salinan; lainnya menunjuk sumber lokal/web.',
  excluded: ['PDF referensi siswa', 'data pribadi asli', 'secret', 'seluruh workspace', 'alat render desain'],
  entries,
}, null, 2) + '\n')
console.log(`Copied ${entries.length} files to docs/studio; registry remains authoritative.`)
