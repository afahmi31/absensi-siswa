import { createHash, randomUUID } from 'node:crypto'
import { builtinModules } from 'node:module'
import { cp, lstat, mkdir, readFile, readdir, realpath, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const sourceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outputParent = path.join(sourceRoot, '.data', 'release-prepared')
const excludedServerPaths = new Set([
  'database/migrate.mjs',
  'database/supabase-role-preflight.mjs',
])
const excludedServerDirectories = new Set(['database/migrations'])
const rootFiles = [
  '.gitignore',
  '.gitattributes',
  '.npmrc',
  '.nvmrc',
  'nuxt.config.ts',
  'tsconfig.json',
  'package-lock.json',
  'vercel.json',
]
const sourceDirectories = ['app', 'server', 'shared', 'public']
const importPattern = /\bfrom\s*['"]([^'"]+)['"]|(?:\bimport|\brequire)\s*\(\s*['"]([^'"]+)['"]\s*\)|\bimport\s*['"]([^'"]+)['"]/g
const nodeBuiltins = new Set(builtinModules.map((name) => name.replace(/^node:/, '')))

function fail(message) {
  throw new Error(message)
}

function gitValue(...args) {
  const result = spawnSync('git', args, { cwd: sourceRoot, encoding: 'utf8', windowsHide: true })
  if (result.error || result.status !== 0) fail('Could not verify the release source revision.')
  return result.stdout.trim()
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
}

function gitPaths(...args) {
  const result = spawnSync('git', args, { cwd: sourceRoot, encoding: 'utf8', windowsHide: true })
  if (result.error || result.status !== 0) fail('Could not verify the release source file inventory.')
  return result.stdout.split('\0').filter(Boolean)
}

async function copyTrackedRuntimeFiles(artifactRoot, trackedFiles) {
  const included = []
  for (const relativePath of trackedFiles.sort()) {
    const [topLevel, ...subpath] = relativePath.split('/')
    const serverPath = subpath.join('/')
    if (!sourceDirectories.includes(topLevel)) continue
    if (topLevel === 'server' && (
      excludedServerPaths.has(serverPath)
      || [...excludedServerDirectories].some((directory) => serverPath === directory || serverPath.startsWith(`${directory}/`))
    )) continue
    const source = path.join(sourceRoot, ...relativePath.split('/'))
    const destination = path.join(artifactRoot, ...relativePath.split('/'))
    const info = await lstat(source)
    if (!info.isFile()) fail(`Release source is not a regular file: ${relativePath}`)
    await mkdir(path.dirname(destination), { recursive: true })
    await cp(source, destination)
    included.push(relativePath)
  }
  return included
}

async function listFiles(root, current = root) {
  const files = []
  const entries = await readdir(current, { withFileTypes: true })
  entries.sort((left, right) => left.name.localeCompare(right.name))
  for (const entry of entries) {
    const item = path.join(current, entry.name)
    if (entry.isDirectory()) files.push(...await listFiles(root, item))
    else if (entry.isFile()) files.push(path.relative(root, item).split(path.sep).join('/'))
    else fail('Generated release tree contains an unsupported file type.')
  }
  return files
}

function packageName(specifier) {
  if (
    specifier.startsWith('.')
    || specifier.startsWith('/')
    || specifier.startsWith('~')
    || specifier.startsWith('@/')
    || specifier.startsWith('#')
    || specifier.startsWith('virtual:')
    || specifier.startsWith('node:')
    || nodeBuiltins.has(specifier)
  ) return null
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

async function auditImports(root, packageJson, lockfile) {
  const imports = new Set()
  for (const relativePath of await listFiles(root)) {
    if (!/\.(?:[cm]?js|ts|tsx|vue)$/.test(relativePath)) continue
    let content = await readFile(path.join(root, ...relativePath.split('/')), 'utf8')
    if (relativePath.endsWith('.vue')) {
      content = [...content.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map((match) => match[1]).join('\n')
    }
    importPattern.lastIndex = 0
    for (const match of content.matchAll(importPattern)) {
      const specifier = match[1] ?? match[2] ?? match[3] ?? ''
      await auditRelativeImport(root, relativePath, specifier)
      const name = packageName(specifier)
      if (name) imports.add(name)
    }
  }
  const declared = new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
  ])
  const transitiveProductionImports = [...imports]
    .filter((name) => !declared.has(name))
    .map((name) => ({ name, entry: lockfile.packages?.[`node_modules/${name}`] }))
  const missingOrNonProduction = transitiveProductionImports
    .filter(({ entry }) => !entry || entry.dev === true)
    .map(({ name }) => name)
  if (missingOrNonProduction.length) {
    fail(`Release imports are not declared or lockfile-backed production packages: ${missingOrNonProduction.sort().join(', ')}`)
  }
  return {
    importedPackages: [...imports].sort(),
    transitiveProductionImports: transitiveProductionImports.map(({ name, entry }) => ({ name, version: entry.version })).sort((left, right) => left.name.localeCompare(right.name)),
  }
}

async function auditRelativeImport(root, importer, specifier) {
  let base
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    base = path.resolve(root, path.dirname(importer), specifier)
  } else if (specifier.startsWith('~/') || specifier.startsWith('@/')) {
    base = path.resolve(root, 'app', specifier.slice(2))
  } else if (specifier.startsWith('~~/') || specifier.startsWith('@@/')) {
    base = path.resolve(root, specifier.slice(3))
  } else {
    return
  }
  if (!isInside(root, base)) fail(`Release import escapes the prepared tree: ${importer}`)
  const candidates = [base, ...['.ts', '.tsx', '.js', '.mjs', '.vue', '.json'].map((extension) => `${base}${extension}`), ...['index.ts', 'index.js', 'index.vue'].map((name) => path.join(base, name))]
  for (const candidate of candidates) {
    const info = await stat(candidate).catch(() => null)
    if (info?.isFile()) return
  }
  fail(`Release import target is missing: ${importer} -> ${specifier}`)
}

async function main() {
  const branch = gitValue('branch', '--show-current')
  if (branch !== 'develop') fail('Release preparation must run from the develop source branch.')
  const sourceCommit = gitValue('rev-parse', 'HEAD')
  await mkdir(outputParent, { recursive: true })
  const resolvedOutputParent = await realpath(outputParent)
  const resolvedData = await realpath(path.join(sourceRoot, '.data'))
  if (!isInside(resolvedData, resolvedOutputParent)) fail('Release output must remain inside the project .data directory.')

  const runId = `release-${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}-${randomUUID()}`
  const runRoot = path.join(resolvedOutputParent, runId)
  const artifactRoot = path.join(runRoot, 'site')
  await mkdir(runRoot, { recursive: false })
  await mkdir(artifactRoot, { recursive: false })

  const untrackedRuntimeFiles = gitPaths('ls-files', '--others', '--exclude-standard', '-z', '--', 'app', 'server', 'shared', 'public')
  if (untrackedRuntimeFiles.length) fail(`Review untracked runtime files before release preparation: ${untrackedRuntimeFiles.join(', ')}`)
  const trackedRuntimeFiles = gitPaths('ls-files', '-z', '--', 'app', 'server', 'shared', 'public')
  const copiedSources = await copyTrackedRuntimeFiles(artifactRoot, trackedRuntimeFiles)

  const sourcePackage = JSON.parse(await readFile(path.join(sourceRoot, 'package.json'), 'utf8'))
  const scripts = {
    build: sourcePackage.scripts?.build,
    postinstall: sourcePackage.scripts?.postinstall,
  }
  if (!scripts.build || !scripts.postinstall) fail('Release package requires its existing build and postinstall scripts.')
  const releasePackage = {
    name: sourcePackage.name,
    version: sourcePackage.version,
    private: true,
    type: sourcePackage.type,
    engines: sourcePackage.engines,
    packageManager: sourcePackage.packageManager,
    scripts,
    dependencies: sourcePackage.dependencies,
    devDependencies: sourcePackage.devDependencies,
  }
  await writeFile(path.join(artifactRoot, 'package.json'), `${JSON.stringify(releasePackage, null, 2)}\n`, { flag: 'wx' })

  for (const name of rootFiles) {
    await cp(path.join(sourceRoot, name), path.join(artifactRoot, name))
  }

  const lockfile = JSON.parse(await readFile(path.join(artifactRoot, 'package-lock.json'), 'utf8'))
  const { importedPackages, transitiveProductionImports } = await auditImports(artifactRoot, releasePackage, lockfile)
  const files = await listFiles(artifactRoot)
  const fileManifest = []
  for (const relativePath of files) {
    const content = await readFile(path.join(artifactRoot, ...relativePath.split('/')))
    fileManifest.push({
      path: relativePath,
      bytes: content.byteLength,
      sha256: createHash('sha256').update(content).digest('hex'),
    })
  }
  const manifest = {
    task: 'LAB002-REL-CLEAN-001',
    sourceBranch: branch,
    sourceCommit,
    artifactRoot: 'site',
    includedSourceFiles: copiedSources,
    excluded: [
      'docs/**',
      'tests/**',
      'scripts/**',
      'server/database/migrations/**',
      'server/database/migrate.mjs',
      'server/database/supabase-role-preflight.mjs',
      'node_modules/**',
      '.nuxt/**',
      '.output/**',
      '.vercel/**',
      '.data/**',
      '.env*',
      '*.log',
    ],
    declaredDependencies: {
      dependencies: Object.keys(releasePackage.dependencies ?? {}).sort(),
      devDependencies: Object.keys(releasePackage.devDependencies ?? {}).sort(),
    },
    importedPackages,
    transitiveProductionImports,
    files: fileManifest,
  }
  const manifestPath = path.join(runRoot, 'release-manifest.json')
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx' })
  process.stdout.write(`Release source tree: ${artifactRoot}\nManifest: ${manifestPath}\nFiles: ${files.length}; external imports: ${importedPackages.length}\n`)
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : 'Release preparation failed.'}\n`)
  process.exitCode = 1
})
