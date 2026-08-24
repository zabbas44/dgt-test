// Pure unit tests for the state machine — these are the counting invariants.
import assert from 'node:assert/strict'
import {
  reducer, initialState, buildQueue, buildTest, summarise, sessionScore,
  firstUnanswered, TEST_LEN,
} from '../src/state/store.js'
import { readFileSync } from 'node:fs'
import { tierFor, badgeFor } from '../src/state/badges.js'

const questions = JSON.parse(readFileSync(new URL('../public/data/questions.json', import.meta.url)))
const byId = new Map(questions.map((q) => [q.i, q]))
let passed = 0
const test = (name, fn) => { fn(); passed++; console.log('  ✓', name) }

const answerAll = (state, choices) => {
  choices.forEach((choice) => {
    const s = state.session
    const q = byId.get(s.queue[s.idx])
    state = reducer(state, { type: 'answer', choice, correct: choice === q.c, elapsed: 3 })
    state = reducer(state, { type: 'goto', index: s.idx + 1 })
  })
  return state
}

console.log('state machine')

test('study: every answer counts exactly once', () => {
  let s = initialState()
  const queue = buildQueue(questions, s.stats, { order: 'seq' }).slice(0, 25)
  s = reducer(s, { type: 'start', mode: 'study', queue })
  s = answerAll(s, Array.from({ length: 25 }, (_, i) => i % 3))
  const sum = summarise(questions, s.stats)
  assert.equal(Object.keys(s.stats).length, 25)
  assert.equal(sum.attempts, 25)
  assert.equal(s.totals.answered, 25)
  assert.equal(sum.correct, s.totals.correct)
  assert.equal(sum.seen, 25)
})

test('study: a second tap on a locked question changes nothing', () => {
  let s = initialState()
  const queue = buildQueue(questions, s.stats, { order: 'seq' }).slice(0, 3)
  s = reducer(s, { type: 'start', mode: 'study', queue })
  const q = byId.get(queue[0])
  s = reducer(s, { type: 'answer', choice: 0, correct: q.c === 0, elapsed: 2 })
  const after = JSON.stringify(s)
  s = reducer(s, { type: 'answer', choice: 1, correct: q.c === 1, elapsed: 2 })
  assert.equal(JSON.stringify(s), after, 'locked answer must be immutable')
  assert.equal(s.totals.answered, 1)
})

test('test mode: the answer can be changed, and only grades once', () => {
  let s = initialState()
  const queue = buildTest(questions, s.stats)
  assert.equal(queue.length, TEST_LEN)
  s = reducer(s, { type: 'start', mode: 'test', queue })
  // change the first answer three times
  s = reducer(s, { type: 'answer', choice: 0, correct: false })
  s = reducer(s, { type: 'answer', choice: 1, correct: false })
  s = reducer(s, { type: 'answer', choice: 2, correct: false })
  assert.equal(s.session.answers[0], 2, 'last tap wins')
  assert.equal(s.totals.answered, 0, 'a test must not touch lifetime stats before submit')
  // answer the rest correctly
  for (let i = 1; i < TEST_LEN; i++) {
    s = reducer(s, { type: 'goto', index: i })
    s = reducer(s, { type: 'answer', choice: byId.get(queue[i]).c, correct: true })
  }
  const correctIndex = queue.map((id) => byId.get(id).c)
  s = reducer(s, { type: 'submitTest', correctIndex })
  assert.equal(s.totals.answered, TEST_LEN, 'exactly 30 attempts recorded')
  const expected = queue.filter((id, i) => correctIndex[i] === s.session.answers[i]).length
  assert.equal(s.totals.correct, expected)
  assert.equal(s.session.score, expected)
  assert.equal(summarise(questions, s.stats).attempts, TEST_LEN)
  // submitting twice must not double count
  const before = JSON.stringify({ t: s.totals, st: s.stats })
  s = reducer(s, { type: 'submitTest', correctIndex })
  assert.equal(JSON.stringify({ t: s.totals, st: s.stats }), before)
})

test('unanswered test questions count as errors, not as skips', () => {
  let s = initialState()
  const queue = buildTest(questions, s.stats)
  s = reducer(s, { type: 'start', mode: 'test', queue })
  s = reducer(s, { type: 'answer', choice: byId.get(queue[0]).c, correct: true })
  s = reducer(s, { type: 'submitTest', correctIndex: queue.map((id) => byId.get(id).c) })
  assert.equal(s.session.score, 1)
  assert.equal(s.totals.answered, TEST_LEN)
  assert.equal(s.totals.correct, 1)
})

test('section test records a best score and a badge', () => {
  let s = initialState()
  const topic = 'senales'
  const queue = buildTest(questions, s.stats, { type: 'topic', key: topic })
  s = reducer(s, { type: 'start', mode: 'test', queue, scope: { type: 'topic', key: topic } })
  queue.forEach((id, i) => {
    s = reducer(s, { type: 'goto', index: i })
    s = reducer(s, { type: 'answer', choice: i < 28 ? byId.get(id).c : (byId.get(id).c + 1) % 3, correct: i < 28 })
  })
  s = reducer(s, { type: 'submitTest', correctIndex: queue.map((id) => byId.get(id).c) })
  assert.equal(s.sectionBest[topic].best, 28)
  assert.equal(badgeFor(s.sectionBest, topic).key, 'gold')
  assert.equal(tierFor(30, 30).key, 'platinum')
  assert.equal(tierFor(25, 30).key, 'silver')
  assert.equal(tierFor(20, 30).key, 'bronze')
  assert.equal(tierFor(19, 30), null)
})

test('session score matches the answers actually given', () => {
  let s = initialState()
  const queue = buildQueue(questions, s.stats, { order: 'random' }).slice(0, 12)
  s = reducer(s, { type: 'start', mode: 'study', queue })
  s = answerAll(s, queue.slice(0, 7).map((id) => byId.get(id).c)) // 7 right
  const sc = sessionScore(s.session, byId)
  assert.equal(sc.answered, 7)
  assert.equal(sc.correct, 7)
  assert.equal(s.totals.correct, 7)
  assert.equal(s.totals.bestStreak, 7)
})

test('resume lands on the first unanswered question', () => {
  let s = initialState()
  const queue = buildQueue(questions, s.stats, { order: 'seq' }).slice(0, 20)
  s = reducer(s, { type: 'start', mode: 'study', queue })
  s = answerAll(s, [0, 1, 2, 0, 1])
  assert.equal(firstUnanswered(s.session), 5)
  s = reducer(s, { type: 'goto', index: 0 })
  assert.equal(firstUnanswered(s.session), 5, 'independent of where the cursor sits')
})

test('queues are unique, correctly sized and correctly scoped', () => {
  const s = initialState()
  const all = buildQueue(questions, s.stats, { order: 'seq' })
  assert.equal(all.length, questions.length)
  assert.equal(new Set(all).size, questions.length)
  const t = buildQueue(questions, s.stats, { scope: { type: 'topic', key: 'senales' } })
  assert.ok(t.length > 0)
  assert.ok(t.every((id) => byId.get(id).t === 'senales'))
  const short = buildQueue(questions, s.stats, { order: 'random', length: 20 })
  assert.equal(short.length, 20)
  assert.equal(new Set(short).size, 20)
  for (const topic of new Set(questions.map((q) => q.t))) {
    const paper = buildTest(questions, s.stats, { type: 'topic', key: topic })
    assert.equal(new Set(paper).size, paper.length, `${topic}: no repeats in a paper`)
    assert.ok(paper.length === Math.min(TEST_LEN, questions.filter((q) => q.t === topic).length))
    assert.ok(paper.every((id) => byId.get(id).t === topic))
  }
})

test('mistake drilling picks up exactly the questions last answered wrong', () => {
  let s = initialState()
  const queue = buildQueue(questions, s.stats, { order: 'seq' }).slice(0, 10)
  s = reducer(s, { type: 'start', mode: 'study', queue })
  s = answerAll(s, queue.map((id, i) => (i < 4 ? (byId.get(id).c + 1) % byId.get(id).es.o.length : byId.get(id).c)))
  const wrong = queue.filter((id, i) => i < 4)
  const drill = buildQueue(questions, s.stats, { scope: { type: 'mistakes' } })
  assert.deepEqual([...drill].sort(), [...wrong].sort())
})

test('reset clears progress but keeps the device id', () => {
  let s = initialState()
  const queue = buildQueue(questions, s.stats, { order: 'seq' }).slice(0, 5)
  s = reducer(s, { type: 'start', mode: 'study', queue })
  s = answerAll(s, [0, 0, 0, 0, 0])
  const id = s.deviceId
  s = reducer(s, { type: 'reset' })
  assert.equal(s.totals.answered, 0)
  assert.deepEqual(s.stats, {})
  assert.equal(s.session, null)
  assert.equal(s.deviceId, id)
})

test('data integrity: every question is answerable and has both languages', () => {
  for (const q of questions) {
    assert.ok(q.es.o.length >= 2 && q.es.o.length === q.en.o.length, `q${q.i} options`)
    assert.ok(q.c >= 0 && q.c < q.es.o.length, `q${q.i} correct index`)
    assert.ok(q.es.q && q.en.q && q.es.e && q.en.e, `q${q.i} text`)
    assert.ok(q.t, `q${q.i} topic`)
  }
  assert.equal(new Set(questions.map((q) => q.i)).size, questions.length)
})

console.log(`\n${passed} unit tests passed\n`)
