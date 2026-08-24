import { chromium } from 'playwright'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const page = await (await b.newContext()).newPage()
const errs = []
page.on('pageerror', e => errs.push(e.message))
await page.goto('file://' + process.cwd() + '/Test-DGT.html')
await page.waitForSelector('.navbar', { timeout: 20000 })
const probe = await page.evaluate(() => {
  let ok = false, err = null
  try { localStorage.setItem('__t', '1'); ok = localStorage.getItem('__t') === '1'; localStorage.removeItem('__t') }
  catch (e) { err = String(e).slice(0, 120) }
  return { ok, err, hasStore: !!localStorage.getItem('dgt.trainer.v2') }
})
console.log('file:// localStorage ->', probe)
// answer one question and reload to see whether it persisted
await page.locator('.card.pri .btn').click()
await page.waitForSelector('.opt')
await page.locator('.opt').first().click()
await page.waitForSelector('.feedback')
const imgW = await page.evaluate(() => document.querySelector('.qphoto')?.naturalWidth || 0)
await page.reload(); await page.waitForSelector('.navbar')
const after = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('dgt.trainer.v2') || 'null') } catch { return 'THROWS' } })
console.log('photo width', imgW, '| answers persisted:', after && after.totals ? after.totals.answered : after)
console.log('errors:', errs.length ? errs.slice(0,3) : 'none')
await b.close()
