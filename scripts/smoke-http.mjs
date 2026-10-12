import { spawn, execFileSync } from 'node:child_process'
import { once } from 'node:events'
import { writeFile } from 'node:fs/promises'

const dev = process.argv.includes('--dev')
const port = dev ? '43128' : '43127'
const env = { ...process.env, PORT: port, NITRO_PORT: port, NUXT_DATABASE_URL: '', NUXT_SUPABASE_URL: '' }
const args = dev
  ? ['node_modules/nuxt/bin/nuxt.mjs', 'dev', '--host', '127.0.0.1', '--port', port, '--strictPort', '--no-fork', '--no-tui']
  : ['scripts/start-node.mjs']
const child = spawn(process.execPath, args, { env, stdio: ['ignore', 'pipe', 'pipe'] })
let serverOutput = ''
child.stdout.on('data', data => { serverOutput += data })
child.stderr.on('data', data => { serverOutput += data })
const result = { checkedAt: new Date().toISOString(), command: `node ${args.join(' ')}`, node: process.version,
  url: `http://127.0.0.1:${port}/`, databaseCredentials: 'blank', envFile: 'not required', requests: [] }
try {
  let response
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error(`Server exited: ${child.exitCode}`)
    try {
      response = await fetch(result.url)
      if (dev && response.status === 503) {
        await new Promise(resolve => setTimeout(resolve, 100))
        continue
      }
      break
    } catch { await new Promise(resolve => setTimeout(resolve, 100)) }
  }
  if (!response) throw new Error('Server did not become available')
  const body = await response.text()
  const expected = ['Website Absensi Siswa', 'Fondasi aplikasi sedang disiapkan.', 'Pengisian absensi belum tersedia.']
  result.status = response.status
  result.textChecks = expected.map(text => ({ text, found: body.includes(text) }))
  result.hasForm = /<form\b/i.test(body)
  result.hasPrivateConfigNames = /databaseUrl|supabaseUrl|NUXT_DATABASE_URL|NUXT_SUPABASE_URL/.test(body)
  if (process.platform === 'win32') {
    const listener = execFileSync('powershell.exe', ['-NoProfile', '-Command',
      `Get-NetTCPConnection -State Listen -LocalPort ${port} | Select-Object LocalAddress,LocalPort,OwningProcess | ConvertTo-Json -Compress`], { encoding: 'utf8' })
    result.listeners = [JSON.parse(listener)].flat()
    result.loopbackOnly = result.listeners.length > 0 && result.listeners.every(item => item.LocalAddress === '127.0.0.1' && item.OwningProcess === child.pid)
  } else {
    result.loopbackOnly = serverOutput.includes(`http://127.0.0.1:${port}`)
  }
  for (const pathname of ['/docs/studio/manifest.json', '/docs/studio/product/PROD-002-product-prd-v1.md']) {
    const probe = await fetch(new URL(pathname, result.url))
    const content = await probe.text()
    result.requests.push({ path: pathname, status: probe.status, exposesSource: content.includes('sourceSha256') || content.includes('# PRD —') })
  }
  result.serverOutput = serverOutput
  result.pass = result.status === 200 && result.textChecks.every(check => check.found)
    && result.loopbackOnly && !result.hasForm && !result.hasPrivateConfigNames && result.requests.every(check => !check.exposesSource)
  process.exitCode = result.pass ? 0 : 1
} catch (error) {
  result.error = error.message
  result.serverOutput = serverOutput
  result.pass = false
  process.exitCode = 1
} finally {
  if (child.exitCode === null) {
    const stopped = once(child, 'exit')
    child.kill()
    await stopped
  }
  result.serverStopped = true
  const filename = dev ? '11-smoke-dev.json' : '07-smoke-http.json'
  await writeFile(`docs/evidence/LAB002-SET-001/${filename}`, JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify(result, null, 2))
}
