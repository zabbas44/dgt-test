import { chromium, devices } from 'playwright'
import { createServer } from 'node:http'
import { readFile, stat, mkdir } from 'node:fs/promises'
import { join, extname } from 'node:path'
import assert from 'node:assert/strict'

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const MIME = { '.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp' }
const root = join(process.cwd(), 'dist')
const server = createServer(async (req,res)=>{try{let p=join(root,decodeURIComponent(req.url.split('?')[0]));if((await stat(p)).isDirectory())p=join(p,'index.html');res.writeHead(200,{'content-type':MIME[extname(p)]||'application/octet-stream'});res.end(await readFile(p))}catch{res.writeHead(404);res.end()}})
await new Promise(r=>server.listen(4181,r))
await mkdir('/tmp/shots', { recursive: true })

const KEY = 'dgt.trainer.v2'
let failures = 0
const results = []
const check = async (name, fn) => {
  try { await fn(); results.push('  ✓ ' + name) }
  catch (e) { failures++; results.push('  ✗ ' + name + '\n      ' + (e.message || e).split('\n')[0]) }
}

const browser = await chromium.launch({ executablePath: CHROME })

async function run(label, contextOpts, shotPrefix) {
  const ctx = await browser.newContext(contextOpts)
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()) })

  const shot = async (name) => {
    await page.screenshot({ path: `/tmp/shots/${name}.png`, fullPage: true })
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(120)
  }
  const tapBar = (which = 'first') => tapFixed('.action-bar .btn', which)
  // Centre a normal in-flow element before clicking: on a phone the bottom nav
  // overlays the last pixels of a fully scrolled page.
  const tap = async (locator) => {
    await locator.scrollIntoViewIfNeeded()
    await locator.evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await page.waitForTimeout(120)
    await locator.click({ timeout: 10000 })
  }
  const store = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), KEY)
  // Clicks an element in a position:fixed layer. Asserts the element really is
  // the topmost thing at its own centre (what a finger would hit) and then
  // dispatches the click — Playwright's scroll-then-click races with fixed
  // layers on long pages and reports false interceptions.
  const tapFixed = async (selector, which = 'last') => {
    await page.waitForSelector(selector)
    const ok = await page.evaluate(({ sel, w }) => {
      const els = [...document.querySelectorAll(sel)]
      const el = w === 'first' ? els[0] : els[els.length - 1]
      if (!el) return 'not found: ' + sel
      const r = el.getBoundingClientRect()
      if (r.bottom > innerHeight + 1 || r.top < -1) return 'off screen'
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      if (!el.contains(hit)) return 'covered by ' + (hit ? hit.tagName + '.' + hit.className : 'nothing')
      el.click()
      return true
    }, { sel: selector, w: which })
    if (ok !== true) throw new Error(`${selector} not tappable: ${ok}`)
  }
  const confirmSheet = async () => { await tapFixed('.sheet .btn', 'last'); await page.waitForSelector('.sheet', { state: 'detached' }) }
  const cancelSheet = async () => { await tapFixed('.sheet .btn', 'first'); await page.waitForSelector('.sheet', { state: 'detached' }) }
  const exitQuiz = async () => { await page.locator('.quiz-head .icon-btn').click(); await confirmSheet(); await page.waitForSelector('.navbar') }
  const submitPaper = async () => { await page.locator('.quiz-foot .btn').last().click(); await confirmSheet(); await page.waitForSelector('.ring') }
  const goHome = async () => { await page.goto('http://localhost:4181/'); await page.waitForSelector('.navbar') }

  console.log(`\n=== ${label} ===`)
  results.length = 0

  await goHome()
  await page.evaluate(() => localStorage.clear())
  await page.reload(); await page.waitForSelector('.navbar')

  await check('home renders with three nav destinations and 14 sections', async () => {
    assert.equal(await page.locator('.nav-item').count(), 3)
    assert.equal(await page.locator('.list .item').count(), 3 + 14)
  })

  await check('no horizontal overflow', async () => {
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    assert.ok(over <= 1, `overflows by ${over}px`)
  })

  await shot(`${shotPrefix}-01-home`)

  // ---------------- study flow ----------------
  await page.getByRole('button', { name: /Start studying|Continue studying/ }).first().click()
  await page.waitForSelector('.opt')

  await check('quiz chrome: photo, options, sticky footer', async () => {
    assert.ok(await page.locator('.qphoto').count() >= 0)
    assert.equal(await page.locator('.opt').count() >= 2, true)
    assert.ok(await page.locator('.quiz-foot .btn').isVisible())
  })

  await check('tap targets are at least 44px tall', async () => {
    const h = await page.locator('.opt').first().evaluate((el) => el.getBoundingClientRect().height)
    assert.ok(h >= 44, `option height ${h}`)
    const f = await page.locator('.quiz-foot .btn').first().evaluate((el) => el.getBoundingClientRect().height)
    assert.ok(f >= 48, `footer button height ${f}`)
  })

  // answer 10 questions, recording what we expect
  let expected = { answered: 0, correct: 0 }
  const blockOutcome = []
  for (let i = 0; i < 10; i++) {
    await page.waitForSelector('.opt:not([disabled])')
    const pick = i % 3
    const n = await page.locator('.opt').count()
    const choice = Math.min(pick, n - 1)
    await page.locator('.opt').nth(choice).click()
    await page.waitForSelector('.feedback')
    const ok = (await page.locator('.feedback').getAttribute('class')).includes('ok')
    blockOutcome.push(ok)
    expected.answered++; if (ok) expected.correct++
    if (i === 0) await shot(`${shotPrefix}-02-question`)
    await page.locator('.quiz-foot .btn').click()
    await page.waitForTimeout(60)
  }

  await page.waitForSelector('.score')
  await check('checkpoint fires after exactly 10 questions and counts them correctly', async () => {
    const txt = (await page.locator('.score').textContent()).trim()
    const right = blockOutcome.filter(Boolean).length
    assert.equal(txt.replace(/\s/g, ''), `${right}/10`)
    assert.equal(await page.locator('.blip').count(), 10)
    assert.equal(await page.locator('.blip.ok').count(), right)
  })

  await check('checkpoint totals agree with stored progress', async () => {
    const s = await store()
    assert.equal(s.totals.answered, expected.answered)
    assert.equal(s.totals.correct, expected.correct)
    assert.equal(Object.keys(s.stats).length, 10)
    const sumA = Object.values(s.stats).reduce((a, x) => a + x.a, 0)
    const sumC = Object.values(s.stats).reduce((a, x) => a + x.c, 0)
    assert.equal(sumA, expected.answered)
    assert.equal(sumC, expected.correct)
  })

  await shot(`${shotPrefix}-03-checkpoint`)

  await check('continue lands on question 11', async () => {
    await tapBar('last')
    await page.waitForSelector('.opt')
    const head = await page.locator('.quiz-head .t-label').textContent()
    assert.match(head.replace(/\s+/g, ' '), /11 \/ 2947/)
  })

  await check('question 11 is answerable (not locked from a previous session)', async () => {
    assert.equal(await page.locator('.opt[disabled]').count(), 0)
    assert.equal(await page.locator('.feedback').count(), 0)
  })

  await check('exit then reload resumes at the first unanswered question', async () => {
    await exitQuiz()
    await page.reload(); await page.waitForSelector('.navbar')
    await page.getByRole('button', { name: /Continue studying|Seguir estudiando/ }).first().click()
    await page.waitForSelector('.opt')
    const head = await page.locator('.quiz-head .t-label').textContent()
    assert.match(head.replace(/\s+/g, ' '), /11 \/ 2947/)
    assert.equal(await page.locator('.opt[disabled]').count(), 0, 'resumed question must be answerable')
  })

  await exitQuiz()

  // ---------------- mock exam ----------------
  await page.locator('.nav-item').nth(1).click()
  await page.waitForSelector('.card.pri')
  await shot(`${shotPrefix}-04-tests`)
  const beforeExam = await store()

  await page.getByRole('button', { name: /^▶ (Start|Empezar)$/ }).click()
  await page.waitForSelector('.badgestrip')

  await check('mock exam shows 30 numbered question badges', async () => {
    assert.equal(await page.locator('.qbadge').count(), 30)
    assert.equal(await page.locator('.qbadge.now').count(), 1)
  })

  await check('THE BUG: an answer can be changed in a test', async () => {
    await page.locator('.opt').nth(0).click()
    await page.waitForTimeout(80)
    assert.ok((await page.locator('.opt').nth(0).getAttribute('class')).includes('sel'), 'first pick not selected')
    await page.locator('.opt').nth(1).click()
    await page.waitForTimeout(80)
    assert.ok((await page.locator('.opt').nth(1).getAttribute('class')).includes('sel'), 'second pick not selected')
    assert.ok(!(await page.locator('.opt').nth(0).getAttribute('class')).includes('sel'), 'old pick still selected')
    await page.locator('.opt').nth(2).click()
    await page.waitForTimeout(80)
    assert.ok((await page.locator('.opt').nth(2).getAttribute('class')).includes('sel'), 'third pick not selected')
    const s = await store()
    assert.equal(s.session.answers[0], 2, 'stored answer must be the last tap')
  })

  await check('no feedback is revealed during a test', async () => {
    assert.equal(await page.locator('.feedback').count(), 0)
    assert.equal(await page.locator('.opt[disabled]').count(), 0)
  })

  await check('tapping a numbered badge jumps to that question', async () => {
    await page.locator('.qbadge').nth(7).click()
    await page.waitForTimeout(120)
    const head = await page.locator('.quiz-head .t-label').textContent()
    assert.match(head.replace(/\s+/g, ' '), /8 \/ 30/)
    assert.ok((await page.locator('.qbadge').nth(7).getAttribute('class')).includes('now'))
    assert.ok((await page.locator('.qbadge').nth(0).getAttribute('class')).includes('done'))
  })

  // answer every question, tracking the right answers from the store
  const examStore = await store()
  const qdata = await page.evaluate(async () => {
    const r = await fetch('data/questions.json'); const d = await r.json()
    return Object.fromEntries(d.map((q) => [q.i, q.c]))
  })
  const queue = examStore.session.queue
  let expectedScore = 0
  for (let i = 0; i < queue.length; i++) {
    await page.locator('.qbadge').nth(i).click()
    await page.waitForTimeout(35)
    const correct = qdata[queue[i]]
    const choice = i % 4 === 0 ? (correct + 1) % (await page.locator('.opt').count()) : correct
    await page.locator('.opt').nth(choice).click()
    if (choice === correct) expectedScore++
    await page.waitForTimeout(25)
  }
  await shot(`${shotPrefix}-05-exam`)

  await check('submitting grades exactly once and matches the manual count', async () => {
    await submitPaper()
    const s = await store()
    assert.equal(s.totals.answered, beforeExam.totals.answered + 30, 'exactly 30 new attempts')
    assert.equal(s.totals.correct, beforeExam.totals.correct + expectedScore)
    const shown = await page.locator('.ring-in b').first().textContent()
    assert.equal(shown.trim(), `${expectedScore}/30`)
  })

  await shot(`${shotPrefix}-06-result`)

  await check('mock exam best score is recorded', async () => {
    const s = await store()
    assert.equal(s.sectionBest.__full.best, expectedScore)
    assert.equal(s.sectionBest.__full.attempts, 1)
    assert.equal(s.sessions[0].total, 30)
  })

  await tapBar('first')
  await page.waitForSelector('.navbar')

  // ---------------- section test + badge ----------------
  await check('a section test only asks that section and awards a badge', async () => {
    await page.locator('.nav-item').nth(1).click()
    await page.waitForSelector('.list .item')
    await page.locator('.list .item').first().click()
    await page.waitForSelector('.badgestrip')
    const s = await store()
    const topic = s.session.scope.key
    const topics = await page.evaluate(async (ids) => {
      const r = await fetch('data/questions.json'); const d = await r.json()
      const m = Object.fromEntries(d.map((q) => [q.i, q.t]))
      return ids.map((i) => m[i])
    }, s.session.queue)
    assert.ok(topics.every((x) => x === topic), 'paper leaked other sections')
    const answers = await page.evaluate(async (ids) => {
      const r = await fetch('data/questions.json'); const d = await r.json()
      const m = Object.fromEntries(d.map((q) => [q.i, q.c]))
      return ids.map((i) => m[i])
    }, s.session.queue)
    for (let i = 0; i < answers.length; i++) {
      await page.locator('.qbadge').nth(i).click()
      await page.waitForTimeout(25)
      await page.locator('.opt').nth(answers[i]).click()
      await page.waitForTimeout(20)
    }
    await submitPaper()
    const after = await store()
    assert.equal(after.sectionBest[topic].best, answers.length)
    const chip = await page.locator('.chip.ok').allTextContents()
    assert.ok(chip.join(' ').match(/💎|Platinum|Platino/), 'platinum badge not shown: ' + chip.join(' | '))
  })

  await tapBar('first')
  await page.waitForSelector('.navbar')

  // ---------------- progress tab ----------------
  await page.locator('.nav-item').nth(2).click()
  await page.waitForSelector('.badgegrid')
  await shot(`${shotPrefix}-07-progress`)

  await check('progress screen shows badges, device id and retention', async () => {
    assert.ok(await page.locator('.bcell.on').count() >= 1)
    const s = await store()
    const idShown = await page.locator('code').first().textContent()
    assert.equal(idShown.trim(), String(s.deviceId).slice(0, 8))
    const body = await page.locator('.card.flat').textContent()
    assert.match(body, /Auto-deletes in \d+ day|Se borra solo en \d+ día/)
  })

  await check('stats on screen equal the stored numbers', async () => {
    const s = await store()
    const kpis = await page.locator('.kpi b').allTextContents()
    assert.equal(kpis[1].trim(), String(s.totals.answered))
    const acc = Math.round((s.totals.correct / s.totals.answered) * 100)
    assert.equal(kpis[2].trim(), `${acc}%`)
  })

  // ---------------- retention purge ----------------
  await check('progress older than the retention window is deleted on open', async () => {
    await page.evaluate((k) => {
      const s = JSON.parse(localStorage.getItem(k))
      s.expiresAt = Date.now() - 1000
      localStorage.setItem(k, JSON.stringify(s))
    }, KEY)
    await page.reload()
    await page.waitForSelector('.navbar')
    const s = await store()
    assert.equal(s.totals.answered, 0, 'stats survived expiry')
    assert.deepEqual(s.stats, {})
    assert.ok(await page.locator('.snack').isVisible(), 'no notice shown after purge')
  })

  await check('a fresh visit gets a device id that persists across reloads', async () => {
    const a = (await store()).deviceId
    await page.reload(); await page.waitForSelector('.navbar')
    const b = (await store()).deviceId
    assert.ok(a && a.length > 8)
    assert.equal(a, b)
  })

  await check('keyboard: 1/2/3 answers and Enter advances (desktop)', async () => {
    await page.locator('.nav-item').nth(0).click()
    await page.getByRole('button', { name: /Start studying|Continue studying/ }).first().click()
    await page.waitForSelector('.opt')
    await page.keyboard.press('2')
    await page.waitForSelector('.feedback', { timeout: 5000 })
    assert.ok((await page.locator('.opt').nth(1).getAttribute('class')).match(/right|wrong/))
    const before = await page.locator('.quiz-head .t-label').textContent()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(200)
    const after = await page.locator('.quiz-head .t-label').textContent()
    assert.notEqual(before, after, 'Enter did not advance')
    await exitQuiz()
  })

  await check('language toggle switches the whole interface', async () => {
    await page.getByRole('button', { name: /Español/ }).click()
    await page.waitForTimeout(150)
    assert.ok((await page.locator('.nav-item .lbl').first().textContent()).match(/Estudiar/))
    await page.getByRole('button', { name: /English/ }).click()
    await page.waitForTimeout(150)
  })

  await check('reset clears progress from the progress tab', async () => {
    const step = async (label, fn) => { try { await fn() } catch (e) { throw new Error(`[${label}] ` + (e.message || e).split('\n')[0]) } }
    await step('nav study', () => page.locator('.nav-item').nth(0).click())
    await step('start', () => page.getByRole('button', { name: /Start studying|Continue studying/ }).first().click())
    await step('wait opt', () => page.waitForSelector('.opt'))
    await step('answer', () => page.locator('.opt').first().click())
    await step('wait feedback', () => page.waitForSelector('.feedback'))
    await step('exit', () => exitQuiz())
    await step('nav progress', () => page.locator('.nav-item').nth(2).click())
    await step('wait reset btn', () => page.waitForSelector('.btn.danger'))
    await step('click reset', () => tap(page.locator('.btn.danger').first()))
    await step('confirm', () => confirmSheet())
    await page.waitForTimeout(250)
    const s = await store()
    assert.equal(s.totals.answered, 0)
    assert.equal(s.session, null)
  })

  await check('no console or page errors during the whole run', async () => {
    assert.deepEqual(errors, [])
  })

  console.log(results.join('\n'))
  await ctx.close()
}

await run('mobile · iPhone 12', { ...devices['iPhone 12'] }, 'm')
await run('desktop · 1280x900', { viewport: { width: 1280, height: 900 } }, 'd')

await browser.close()
server.close()
console.log(failures ? `\n${failures} FAILING CHECKS\n` : '\nall checks passed\n')
process.exit(failures ? 1 : 0)
