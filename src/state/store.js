// ---------------------------------------------------------------------------
// Single source of truth for the trainer.
//
// Everything the app shows is either stored here or derived from here with a
// pure selector. The reducer never performs side effects, so React 18 Strict
// Mode's double invocation cannot double-count an answer.
// ---------------------------------------------------------------------------

export const STORAGE_KEY = 'dgt.trainer.v2'
const LEGACY_KEY = 'dgt-b-trainer-v1'

export const RETENTION_DAYS = 60 // "about two months", refreshed on every use
export const BLOCK = 10 // review after every 10 questions
export const TEST_LEN = 30 // DGT paper length
export const TEST_MAX_ERRORS = 3 // DGT pass mark
export const TEST_SECONDS = 30 * 60

const DAY = 24 * 60 * 60 * 1000

// ---------------------------------------------------------------------------
// identity + persistence
// ---------------------------------------------------------------------------

export function newDeviceId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const b = crypto.getRandomValues(new Uint8Array(16))
      return [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
    }
  } catch { /* fall through */ }
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function initialState(now = Date.now()) {
  return {
    v: 2,
    deviceId: newDeviceId(),
    createdAt: now,
    updatedAt: now,
    expiresAt: now + RETENTION_DAYS * DAY,
    lang: 'en',
    stats: {},                    // qid -> { a, c, l, ts }
    totals: { answered: 0, correct: 0, bestStreak: 0, streak: 0 },
    sectionBest: {},              // topic -> { best, attempts }
    sessions: [],                 // finished sessions, newest first
    session: null,                // the session in progress
    lastPurge: null,              // set when saved data was dropped on expiry
  }
}

// Pulls forward progress from the first version of the app, if any.
function migrateLegacy(now) {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return null
    const old = JSON.parse(raw)
    const s = initialState(now)
    s.lang = old.lang === 'es' ? 'es' : 'en'
    s.stats = Object.fromEntries(
      Object.entries(old.stats || {}).map(([k, v]) => [k, { a: v.a | 0, c: v.c | 0, l: v.l ? 1 : 0, ts: v.t || now }])
    )
    s.totals = {
      answered: old.totals?.answered | 0,
      correct: old.totals?.correct | 0,
      bestStreak: old.totals?.bestStreak | 0,
      streak: 0,
    }
    s.sessions = Array.isArray(old.sessions) ? old.sessions.slice(0, 40) : []
    s.migratedFrom = 'v1'
    return s
  } catch {
    return null
  }
}

export function loadState(now = Date.now()) {
  let parsed = null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) parsed = JSON.parse(raw)
  } catch { parsed = null }

  if (!parsed || parsed.v !== 2 || !parsed.deviceId) {
    const migrated = migrateLegacy(now)
    return migrated || initialState(now)
  }

  // Retention: saved progress older than RETENTION_DAYS since last use is dropped.
  if (typeof parsed.expiresAt === 'number' && now > parsed.expiresAt) {
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    const fresh = initialState(now)
    fresh.lastPurge = { at: now, expiredAt: parsed.expiresAt }
    return fresh
  }

  const base = initialState(now)
  return {
    ...base,
    ...parsed,
    totals: { ...base.totals, ...(parsed.totals || {}) },
    stats: parsed.stats || {},
    sectionBest: parsed.sectionBest || {},
    sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
  }
}

export function saveState(state, now = Date.now()) {
  try {
    const toSave = { ...state, updatedAt: now, expiresAt: now + RETENTION_DAYS * DAY }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
    return toSave
  } catch {
    return state // private mode / quota — the app still works for this visit
  }
}

// Some browsers block storage for pages opened straight from disk or in
// private mode. The app still works, but progress cannot be kept, so it says so.
export function storageWorks() {
  try {
    const k = '__dgt_probe__'
    localStorage.setItem(k, '1')
    const ok = localStorage.getItem(k) === '1'
    localStorage.removeItem(k)
    return ok
  } catch {
    return false
  }
}

export function clearStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(LEGACY_KEY)
  } catch { /* ignore */ }
}

export const daysLeft = (state, now = Date.now()) =>
  Math.max(0, Math.ceil(((state.updatedAt || now) + RETENTION_DAYS * DAY - now) / DAY))

// ---------------------------------------------------------------------------
// queue building
// ---------------------------------------------------------------------------

export function shuffle(arr, rand = Math.random) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const weakness = (stats, id) => {
  const s = stats[id]
  if (!s || !s.a) return 0.45          // unseen: ahead of mastered, behind failed
  return s.c / s.a + (s.l === 1 ? 0.5 : -0.5)
}

export function buildQueue(questions, stats, opts = {}) {
  const { scope = { type: 'all' }, order = 'seq', length = 'all', ids } = opts

  let pool
  if (scope.type === 'topic') pool = questions.filter((q) => q.t === scope.key)
  else if (scope.type === 'mistakes') pool = questions.filter((q) => stats[q.i] && stats[q.i].a && stats[q.i].l === 0)
  else if (scope.type === 'ids') pool = questions.filter((q) => (ids || []).includes(q.i))
  else pool = questions

  let list
  if (order === 'random') list = shuffle(pool)
  else if (order === 'weak') list = shuffle(pool).sort((a, b) => weakness(stats, a.i) - weakness(stats, b.i))
  else if (order === 'unseen') {
    const unseen = pool.filter((q) => !stats[q.i] || !stats[q.i].a)
    const seen = pool.filter((q) => stats[q.i] && stats[q.i].a)
    list = [...shuffle(unseen), ...shuffle(seen)]
  } else {
    const ordered = [...pool].sort((a, b) => a.i - b.i)
    const at = ordered.findIndex((q) => !stats[q.i] || !stats[q.i].a) // resume where you stopped
    list = at <= 0 ? ordered : [...ordered.slice(at), ...ordered.slice(0, at)]
  }

  let out = list.map((q) => q.i)
  if (length !== 'all' && Number.isFinite(length)) out = out.slice(0, length)
  return out
}

// A test paper: TEST_LEN questions spread across the sections of the pool.
export function buildTest(questions, stats, scope = { type: 'all' }, len = TEST_LEN) {
  const pool = scope.type === 'topic' ? questions.filter((q) => q.t === scope.key) : questions
  if (pool.length <= len) return shuffle(pool).map((q) => q.i)

  const byTopic = {}
  for (const q of pool) (byTopic[q.t] ||= []).push(q)
  const topics = shuffle(Object.keys(byTopic))
  const buckets = topics.map((k) => shuffle(byTopic[k]))
  const picked = []
  let round = 0
  while (picked.length < len) {
    let progressed = false
    for (const b of buckets) {
      if (picked.length >= len) break
      if (round < b.length) { picked.push(b[round].i); progressed = true }
    }
    if (!progressed) break
    round++
  }
  return shuffle(picked).slice(0, len)
}

// ---------------------------------------------------------------------------
// reducer
// ---------------------------------------------------------------------------

const emptySession = (mode, queue, extra = {}) => ({
  id: `${mode}-${Date.now()}`,
  mode,                                   // 'study' | 'test'
  queue,
  answers: new Array(queue.length).fill(null),
  times: new Array(queue.length).fill(0),
  idx: 0,
  startedAt: Date.now(),
  lastCheckpoint: 0,
  streak: 0,
  finished: false,
  scope: { type: 'all' },
  ...extra,
})

// First index with no answer yet, or the last index when everything is answered.
export const firstUnanswered = (session) => {
  const at = session.answers.findIndex((x) => x == null)
  return at === -1 ? session.queue.length - 1 : at
}

export function reducer(state, action) {
  switch (action.type) {
    case 'lang':
      return { ...state, lang: action.lang }

    case 'start': {
      const { mode, queue } = action
      if (!queue || !queue.length) return state
      return {
        ...state,
        session: emptySession(mode, queue, {
          scope: action.scope || { type: 'all' },
          endsAt: mode === 'test' ? Date.now() + TEST_SECONDS * 1000 : null,
          label: action.label || null,
        }),
      }
    }

    // Study mode: one answer per question, locked once given, stats update now.
    // Test mode: the answer can be changed until the paper is submitted, and
    // nothing touches the lifetime stats until then.
    case 'answer': {
      const s = state.session
      if (!s || s.finished) return state
      const { choice, correct, elapsed = 0 } = action
      const answers = [...s.answers]
      const times = [...s.times]

      if (s.mode === 'test') {
        answers[s.idx] = choice
        times[s.idx] = times[s.idx] || elapsed
        return { ...state, session: { ...s, answers, times } }
      }

      if (answers[s.idx] != null) return state // already locked
      answers[s.idx] = choice
      times[s.idx] = elapsed

      const id = s.queue[s.idx]
      const prev = state.stats[id] || { a: 0, c: 0, l: 0, ts: 0 }
      const streak = correct ? (s.streak || 0) + 1 : 0
      return {
        ...state,
        stats: {
          ...state.stats,
          [id]: { a: prev.a + 1, c: prev.c + (correct ? 1 : 0), l: correct ? 1 : 0, ts: Date.now() },
        },
        totals: {
          answered: state.totals.answered + 1,
          correct: state.totals.correct + (correct ? 1 : 0),
          streak,
          bestStreak: Math.max(state.totals.bestStreak || 0, streak),
        },
        session: { ...s, answers, times, streak },
      }
    }

    case 'goto': {
      const s = state.session
      if (!s) return state
      const idx = Math.max(0, Math.min(action.index, s.queue.length - 1))
      return { ...state, session: { ...s, idx } }
    }

    case 'checkpointPassed': {
      const s = state.session
      if (!s) return state
      return { ...state, session: { ...s, lastCheckpoint: action.at } }
    }

    // Grading a test writes every answer into the lifetime stats exactly once.
    case 'submitTest': {
      const s = state.session
      if (!s || s.mode !== 'test' || s.finished) return state
      const stats = { ...state.stats }
      let correct = 0
      s.queue.forEach((id, i) => {
        const ok = action.correctIndex[i] === s.answers[i] && s.answers[i] != null
        if (ok) correct++
        const prev = stats[id] || { a: 0, c: 0, l: 0, ts: 0 }
        stats[id] = { a: prev.a + 1, c: prev.c + (ok ? 1 : 0), l: ok ? 1 : 0, ts: Date.now() }
      })
      const sectionBest = { ...state.sectionBest }
      if (s.scope.type === 'topic') {
        const prev = sectionBest[s.scope.key] || { best: 0, attempts: 0 }
        sectionBest[s.scope.key] = {
          best: Math.max(prev.best, correct),
          attempts: prev.attempts + 1,
          lastAt: Date.now(),
          outOf: s.queue.length,
        }
      } else {
        const prev = sectionBest.__full || { best: 0, attempts: 0 }
        sectionBest.__full = {
          best: Math.max(prev.best, correct),
          attempts: prev.attempts + 1,
          lastAt: Date.now(),
          outOf: s.queue.length,
        }
      }
      return {
        ...state,
        stats,
        sectionBest,
        totals: {
          ...state.totals,
          answered: state.totals.answered + s.queue.length,
          correct: state.totals.correct + correct,
          streak: 0,
        },
        sessions: [
          { ts: Date.now(), mode: 'test', scope: s.scope, total: s.queue.length, correct, seconds: Math.round((Date.now() - s.startedAt) / 1000) },
          ...state.sessions,
        ].slice(0, 40),
        session: { ...s, finished: true, finishedAt: Date.now(), score: correct },
      }
    }

    case 'endSession': {
      const s = state.session
      if (!s) return { ...state, session: null }
      const answered = s.answers.filter((x) => x != null).length
      const sessions =
        s.mode === 'study' && answered > 0 && !s.finished
          ? [{ ts: Date.now(), mode: 'study', scope: s.scope, total: answered, correct: action.correct || 0, seconds: Math.round((Date.now() - s.startedAt) / 1000) }, ...state.sessions].slice(0, 40)
          : state.sessions
      return { ...state, sessions, session: null }
    }

    case 'reset':
      return { ...initialState(), deviceId: state.deviceId, lang: state.lang }

    case 'hydrate':
      return action.state

    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// selectors
// ---------------------------------------------------------------------------

export function summarise(questions, stats) {
  let seen = 0, mastered = 0, attempts = 0, correct = 0
  const byTopic = {}
  for (const q of questions) {
    const t = (byTopic[q.t] ||= { total: 0, seen: 0, mastered: 0, attempts: 0, correct: 0, wrongNow: 0 })
    t.total++
    const s = stats[q.i]
    if (!s || !s.a) continue
    seen++; attempts += s.a; correct += s.c
    t.seen++; t.attempts += s.a; t.correct += s.c
    if (s.l === 1) { mastered++; t.mastered++ } else t.wrongNow++
  }
  for (const t of Object.values(byTopic)) {
    t.accuracy = t.attempts ? t.correct / t.attempts : null
    t.coverage = t.total ? t.mastered / t.total : 0
  }
  return {
    total: questions.length,
    seen,
    mastered,
    attempts,
    correct,
    accuracy: attempts ? correct / attempts : 0,
    coverage: questions.length ? mastered / questions.length : 0,
    byTopic,
  }
}

export const mistakeIds = (questions, stats) =>
  questions.filter((q) => stats[q.i] && stats[q.i].a && stats[q.i].l === 0).map((q) => q.i)

export const sessionScore = (session, byId) => {
  if (!session) return { answered: 0, correct: 0 }
  let answered = 0, correct = 0
  session.answers.forEach((choice, i) => {
    if (choice == null) return
    answered++
    if (byId.get(session.queue[i])?.c === choice) correct++
  })
  return { answered, correct }
}

export const projectedErrors = (accuracy) => Math.round((1 - accuracy) * TEST_LEN)

// Reads the retention metadata that was actually written to disk, so the UI can
// show a truthful countdown without re-rendering on every save.
export function readSavedMeta() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const { updatedAt, expiresAt, createdAt } = JSON.parse(raw)
    return { updatedAt, expiresAt, createdAt }
  } catch {
    return null
  }
}
