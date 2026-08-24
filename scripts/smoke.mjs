import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname } from 'node:path'

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp' }
const root = join(process.cwd(), 'dist')
const server = createServer(async (req, res) => {
  try {
    let p = join(root, decodeURIComponent(req.url.split('?')[0]))
    if ((await stat(p)).isDirectory()) p = join(p, 'index.html')
    res.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' })
    res.end(await readFile(p))
  } catch { res.writeHead(404); res.end('nope') }
})
await new Promise((r) => server.listen(4173, r))

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const page = await browser.newPage({ viewport: { width: 1180, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })
const failedImages = []
page.on('response', (r) => { if (r.status() >= 400) failedImages.push(r.url() + ' -> ' + r.status()) })

await page.goto('http://localhost:4173/', { waitUntil: 'networkidle' })
await page.waitForSelector('.hero', { timeout: 15000 })
await page.screenshot({ path: '/tmp/shots/01-home.png', fullPage: true })

// start a study session
await page.click('.action.primary')
await page.waitForSelector('.opt')
const imgOk = await page.evaluate(() => {
  const im = document.querySelector('img.photo')
  return im ? im.naturalWidth : 0
})
console.log('photo natural width:', imgOk)
await page.screenshot({ path: '/tmp/shots/02-question.png', fullPage: true })

// answer 10 questions, deliberately mixing right and wrong answers
for (let i = 0; i < 10; i++) {
  await page.waitForSelector('.opt:not([disabled])', { timeout: 10000 })
  const opts = await page.$$('.opt')
  await opts[i % opts.length].click()
  await page.waitForSelector('.verdict', { timeout: 5000 })
  if (i === 0) await page.screenshot({ path: '/tmp/shots/03-answered.png', fullPage: true })
  await page.click('.footbar .btn')
  await page.waitForTimeout(120)
}
await page.waitForSelector('.score-big', { timeout: 10000 })
const cp = await page.textContent('.score-big')
console.log('checkpoint score:', cp.trim())
await page.screenshot({ path: '/tmp/shots/04-checkpoint.png', fullPage: true })

// continue, then go home and check progress persisted
await page.click('.row .btn')
await page.waitForSelector('.opt')
await page.click('.topbar .ghost-btn')
await page.waitForSelector('.kpis')
const kpis = await page.$$eval('.kpi b', (n) => n.map((x) => x.textContent))
console.log('home KPIs:', kpis.join(' | '))

// exam mode
await page.click('text=📝')
await page.waitForSelector('.timer')
const examTotal = await page.textContent('.qcount')
console.log('exam header:', examTotal.replace(/\s+/g, ' ').trim())
await page.screenshot({ path: '/tmp/shots/05-exam.png', fullPage: true })

// language toggle
await page.click('.topbar .ghost-btn:last-child')
await page.waitForTimeout(200)
await page.screenshot({ path: '/tmp/shots/06-lang.png', fullPage: true })

// reload -> session should resume from storage
await page.reload({ waitUntil: 'networkidle' })
await page.waitForSelector('.hero, .opt', { timeout: 15000 })
const resumed = await page.$('.action.primary')
console.log('resume button:', (await resumed.textContent()).replace(/\s+/g, ' ').trim())

console.log('ERRORS:', errors.length ? errors.slice(0, 8) : 'none')
console.log('HTTP FAILURES:', failedImages.length ? failedImages.slice(0, 5) : 'none')
await browser.close()
server.close()
