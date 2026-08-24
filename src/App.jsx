import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { loadQuestions } from './lib/data.js'
import { useT } from './lib/i18n.js'
import { TOPICS, topicName } from './lib/topics.js'
import {
  reducer, loadState, saveState, clearStorage, buildQueue, buildTest, summarise, mistakeIds,
  sessionScore, firstUnanswered, storageWorks, BLOCK, TEST_SECONDS,
} from './state/store.js'
import HomeScreen from './ui/HomeScreen.jsx'
import TestsScreen from './ui/TestsScreen.jsx'
import ProgressScreen from './ui/ProgressScreen.jsx'
import QuizScreen from './ui/QuizScreen.jsx'
import CheckpointScreen from './ui/CheckpointScreen.jsx'
import ResultScreen from './ui/ResultScreen.jsx'
import { Confirm } from './ui/bits.jsx'

export default function App() {
  const [questions, setQuestions] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [state, dispatch] = useReducer(reducer, undefined, () => loadState())
  const [tab, setTab] = useState('study')
  const [view, setView] = useState('tabs') // tabs | quiz | checkpoint | result
  const [checkpoint, setCheckpoint] = useState(null)
  const [result, setResult] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [snack, setSnack] = useState(state.lastPurge ? 'purged' : null)
  const [tick, setTick] = useState(0)
  const [storageOk] = useState(() => storageWorks())
  const qStart = useRef(Date.now())

  const t = useT(state.lang)
  const lang = state.lang
  const session = state.session

  useEffect(() => { loadQuestions().then(setQuestions).catch((e) => setLoadError(String(e))) }, [])
  useEffect(() => { saveState(state) }, [state])
  useEffect(() => {
    document.documentElement.lang = lang
    document.title = lang === 'es' ? 'Test DGT · Permiso B' : 'DGT Theory Test · Permiso B'
  }, [lang])

  const byId = useMemo(() => new Map((questions || []).map((q) => [q.i, q])), [questions])
  const summary = useMemo(
    () => (questions ? summarise(questions, state.stats) : { total: 0, seen: 0, mastered: 0, attempts: 0, correct: 0, accuracy: 0, coverage: 0, byTopic: {} }),
    [questions, state.stats]
  )
  const mistakes = useMemo(() => (questions ? mistakeIds(questions, state.stats) : []), [questions, state.stats])
  const counts = useMemo(() => {
    const c = {}
    for (const q of questions || []) c[q.t] = (c[q.t] || 0) + 1
    return c
  }, [questions])

  // ---- test clock -------------------------------------------------------
  useEffect(() => {
    if (view !== 'quiz' || !session || session.mode !== 'test' || session.finished) return
    const id = setInterval(() => setTick((x) => x + 1), 1000)
    return () => clearInterval(id)
  }, [view, session && session.id, session && session.finished])

  const timeLeft = session && session.endsAt ? Math.max(0, Math.round((session.endsAt - Date.now()) / 1000)) : TEST_SECONDS

  // ---- session control --------------------------------------------------
  const start = useCallback((opts) => {
    if (!questions) return
    const { mode = 'study', scope = { type: 'all' } } = opts
    // A part-finished study session that is being replaced still counts as a
    // session, so record it before the new queue overwrites it.
    if (session && !session.finished && session.mode === 'study') {
      const sc = sessionScore(session, byId)
      if (sc.answered > 0) dispatch({ type: 'endSession', correct: sc.correct })
    }
    const queue =
      mode === 'test'
        ? buildTest(questions, state.stats, scope)
        : buildQueue(questions, state.stats, { scope, order: opts.order || 'seq', length: opts.length ?? 'all', ids: opts.ids })
    if (!queue.length) return
    qStart.current = Date.now()
    dispatch({ type: 'start', mode, queue, scope, label: opts.label })
    setCheckpoint(null)
    setResult(null)
    setView('quiz')
  }, [questions, state.stats, session, byId])

  const resume = useCallback(() => {
    if (!session) return
    if (session.mode === 'study') {
      const at = firstUnanswered(session)
      if (at !== session.idx) dispatch({ type: 'goto', index: at })
    }
    qStart.current = Date.now()
    setView('quiz')
  }, [session])

  const answer = useCallback((choice) => {
    if (!session) return
    const q = byId.get(session.queue[session.idx])
    dispatch({
      type: 'answer',
      choice,
      correct: choice === q.c,
      elapsed: Math.max(0, Math.round((Date.now() - qStart.current) / 1000)),
    })
  }, [session, byId])

  const goNext = useCallback(() => {
    if (!session) return
    const nextIdx = session.idx + 1
    qStart.current = Date.now()
    if (session.mode === 'test') {
      dispatch({ type: 'goto', index: nextIdx })
      return
    }
    const atEnd = nextIdx >= session.queue.length
    if (atEnd || nextIdx % BLOCK === 0) {
      setCheckpoint({ from: session.lastCheckpoint, to: nextIdx, isFinal: atEnd })
      dispatch({ type: 'goto', index: atEnd ? session.queue.length - 1 : nextIdx })
      dispatch({ type: 'checkpointPassed', at: nextIdx })
      setView('checkpoint')
      return
    }
    dispatch({ type: 'goto', index: nextIdx })
  }, [session])

  const submitTest = useCallback((auto = false) => {
    if (!session || session.mode !== 'test' || session.finished) return
    const correctIndex = session.queue.map((id) => byId.get(id).c)
    const score = session.answers.filter((a, i) => a != null && a === correctIndex[i]).length
    const key = session.scope.type === 'topic' ? session.scope.key : '__full'
    const prevBest = state.sectionBest?.[key]?.best ?? -1
    setResult({
      items: session.queue.map((id, i) => ({ q: byId.get(id), chosen: session.answers[i] })),
      seconds: Math.round((Date.now() - session.startedAt) / 1000),
      scopeLabel: session.scope.type === 'topic' ? `${t.sectionResult} · ${topicName(session.scope.key, lang)}` : t.examResult,
      isNewBest: score > prevBest,
      scope: session.scope,
    })
    dispatch({ type: 'submitTest', correctIndex })
    setView('result')
    if (auto) setSnack('timeup')
  }, [session, byId, state.sectionBest, t, lang])

  // auto-submit when the clock runs out
  useEffect(() => {
    if (view !== 'quiz' || !session || session.mode !== 'test' || session.finished) return
    if (session.endsAt && Date.now() >= session.endsAt) submitTest(true)
  }, [tick, view, session, submitTest])

  // Step away without losing your place: the queue and every answer stay put,
  // so "Continue studying" comes back to the exact question you were on.
  const pause = useCallback(() => {
    setCheckpoint(null)
    setResult(null)
    setView('tabs')
  }, [])

  const endSession = useCallback(() => {
    if (session) {
      const sc = sessionScore(session, byId)
      dispatch({ type: 'endSession', correct: sc.correct })
    }
    setCheckpoint(null)
    setResult(null)
    setView('tabs')
  }, [session, byId])

  useEffect(() => {
    if (!snack) return
    const id = setTimeout(() => setSnack(null), 5200)
    return () => clearTimeout(id)
  }, [snack])

  // ---- render -----------------------------------------------------------
  if (loadError) {
    return (
      <div className="loading">
        <p>⚠️ {loadError}</p>
        <p className="t-cap">Open Test-DGT.html, or run the project with npm run dev.</p>
      </div>
    )
  }
  if (!questions) {
    return (
      <div className="loading">
        <div>
          <div className="spin" />
          <p style={{ marginTop: 14 }}>{t.loading}</p>
        </div>
      </div>
    )
  }

  const inQuiz = view === 'quiz' && session
  const blockItems = () =>
    !checkpoint || !session
      ? []
      : session.queue.slice(checkpoint.from, checkpoint.to).map((id, k) => ({
          q: byId.get(id),
          chosen: session.answers[checkpoint.from + k],
        }))

  if (inQuiz) {
    const q = byId.get(session.queue[session.idx])
    const nextId = session.queue[session.idx + 1]
    const chosen = session.answers[session.idx]
    return (
      <div className="app">
        <QuizScreen
          t={t}
          lang={lang}
          q={q}
          nextImg={nextId ? byId.get(nextId).img : null}
          index={session.idx}
          total={session.queue.length}
          mode={session.mode}
          chosen={chosen}
          revealed={session.mode === 'study' && chosen != null}
          answers={session.answers}
          timeLeft={timeLeft}
          onAnswer={answer}
          onNext={goNext}
          onPrev={() => dispatch({ type: 'goto', index: session.idx - 1 })}
          onJump={(i) => dispatch({ type: 'goto', index: i })}
          onExit={() => setConfirm(session.mode === 'test' ? 'abandon' : 'exit')}
          onSubmit={() => setConfirm('submit')}
        />
        <Confirm
          open={confirm === 'exit'}
          text={t.exitConfirm}
          confirmLabel={t.exit}
          cancelLabel={t.cancel}
          onCancel={() => setConfirm(null)}
          onConfirm={() => { setConfirm(null); pause() }}
        />
        <Confirm
          open={confirm === 'abandon'}
          text={t.abandonConfirm}
          confirmLabel={t.exit}
          cancelLabel={t.cancel}
          danger
          onCancel={() => setConfirm(null)}
          onConfirm={() => { setConfirm(null); endSession() }}
        />
        <Confirm
          open={confirm === 'submit'}
          text={t.submitConfirm(session.answers.filter((x) => x == null).length)}
          confirmLabel={t.submit}
          cancelLabel={t.cancel}
          onCancel={() => setConfirm(null)}
          onConfirm={() => { setConfirm(null); submitTest(false) }}
        />
        {snack && <div className="snack">{snack === 'timeup' ? t.timeUp : t.purged}</div>}
      </div>
    )
  }

  const showTabs = view === 'tabs'
  const title =
    view === 'checkpoint' ? (checkpoint?.isFinal ? t.sessionDone : t.checkpoint)
      : view === 'result' ? (result?.scopeLabel || t.examResult)
      : tab === 'tests' ? t.navTests
      : tab === 'progress' ? t.navProgress
      : t.appTitle

  return (
    <div className="app">
      <header className="appbar">
        <div className="appbar-in">
          {!showTabs && (
            <button className="icon-btn" onClick={view === 'checkpoint' && !checkpoint?.isFinal ? pause : endSession} aria-label={t.backHome}>←</button>
          )}
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="appbar-title">{title}</div>
            {showTabs && tab === 'study' && <div className="appbar-sub">{t.appSub}</div>}
          </div>
          <button
            className="btn text sm"
            onClick={() => dispatch({ type: 'lang', lang: lang === 'en' ? 'es' : 'en' })}
          >
            🌐 {t.langName}
          </button>
        </div>
      </header>

      <main className={`screen${showTabs ? '' : ' noNav hasBar'}`}>
        {!storageOk && showTabs && (
          <div className="card flat p12" style={{ borderColor: 'var(--warning)', marginBottom: 12 }}>
            <b className="t-label">⚠ {t.noStorage}</b>
            <div className="t-cap">{t.noStorageHint}</div>
          </div>
        )}
        {showTabs && tab === 'study' && (
          <HomeScreen
            t={t} lang={lang} summary={summary} mistakes={mistakes} session={session}
            sectionBest={state.sectionBest} counts={counts}
            onStart={start} onResume={resume}
          />
        )}
        {showTabs && tab === 'tests' && (
          <TestsScreen t={t} lang={lang} sectionBest={state.sectionBest} counts={counts} onStart={start} />
        )}
        {showTabs && tab === 'progress' && (
          <ProgressScreen
            t={t} lang={lang} state={state} summary={summary}
            onReset={() => { clearStorage(); dispatch({ type: 'reset' }); setTab('study'); setView('tabs') }}
          />
        )}

        {view === 'checkpoint' && checkpoint && session && (
          <CheckpointScreen
            t={t} lang={lang}
            block={blockItems()}
            from={checkpoint.from + 1}
            to={checkpoint.to}
            isFinal={checkpoint.isFinal}
            session={sessionScore(session, byId)}
            lifetime={{ attempts: state.totals.answered, correct: state.totals.correct }}
            bestStreak={state.totals.bestStreak || 0}
            avgSeconds={(() => {
              const ts = session.times.filter((x, i) => session.answers[i] != null)
              return ts.length ? Math.round(ts.reduce((a, b) => a + b, 0) / ts.length) : 0
            })()}
            onContinue={() => { qStart.current = Date.now(); setView('quiz') }}
            onHome={checkpoint.isFinal ? endSession : pause}
            onDrill={() => {
              const ids = blockItems().filter((b) => b.chosen !== b.q.c).map((b) => b.q.i)
              start({ mode: 'study', order: 'random', scope: { type: 'ids' }, ids })
            }}
          />
        )}

        {view === 'result' && result && (
          <ResultScreen
            t={t} lang={lang}
            items={result.items}
            seconds={result.seconds}
            scopeLabel={result.scopeLabel}
            isNewBest={result.isNewBest}
            onHome={endSession}
            onRetake={() => start({ mode: 'test', scope: result.scope })}
            onDrill={() => {
              const ids = result.items.filter((i) => i.chosen !== i.q.c).map((i) => i.q.i)
              start({ mode: 'study', order: 'random', scope: { type: 'ids' }, ids })
            }}
          />
        )}
      </main>

      {showTabs && (
        <nav className="navbar">
          <div className="navbar-in">
            {[
              { key: 'study', icon: '📚', label: t.navStudy },
              { key: 'tests', icon: '📝', label: t.navTests },
              { key: 'progress', icon: '📊', label: t.navProgress },
            ].map((it) => (
              <button key={it.key} className={`nav-item${tab === it.key ? ' on' : ''}`} onClick={() => setTab(it.key)}>
                <span className="ico" aria-hidden>{it.icon}</span>
                <span className="lbl">{it.label}</span>
              </button>
            ))}
          </div>
        </nav>
      )}

      {snack && <div className="snack">{snack === 'timeup' ? t.timeUp : t.purged}</div>}
    </div>
  )
}
