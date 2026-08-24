import React from 'react'
import { topicName, topicIcon } from '../lib/topics.js'
import { Linear, Kpi, pct } from './bits.jsx'
import MissedList from './MissedList.jsx'
import { TEST_LEN, TEST_MAX_ERRORS, projectedErrors } from '../state/store.js'

export default function CheckpointScreen({
  t, lang, block, from, to, isFinal, session, lifetime, bestStreak, avgSeconds,
  onContinue, onHome, onDrill,
}) {
  const right = block.filter((b) => b.chosen === b.q.c).length
  const ratio = block.length ? right / block.length : 0
  const wrong = block.filter((b) => b.chosen !== b.q.c)
  const verdict = ratio >= 0.95 ? t.verdictGreat : ratio >= 0.9 ? t.verdictGood : ratio >= 0.8 ? t.verdictOk : t.verdictBad

  const sessionAcc = session.answered ? session.correct / session.answered : 0
  const lifeAcc = lifetime.attempts ? lifetime.correct / lifetime.attempts : 0
  const projected = projectedErrors(sessionAcc)
  const passing = projected <= TEST_MAX_ERRORS

  const byTopic = {}
  for (const b of block) {
    const e = (byTopic[b.q.t] ||= { n: 0, ok: 0 })
    e.n++
    if (b.chosen === b.q.c) e.ok++
  }
  const topicRows = Object.entries(byTopic).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n)

  return (
    <div className="stack lg fade">
      <div className="card p16 stack">
        <div className="row">
          <div className="grow">
            <h2 className="t-title">{isFinal ? t.sessionDone : t.checkpoint}</h2>
            <div className="t-cap">{isFinal ? t.sessionDoneSub : t.range(from, to)}</div>
          </div>
          <span className={`chip ${ratio >= 0.9 ? 'ok' : ratio >= 0.8 ? 'warn' : 'bad'}`}>{pct(ratio)}</span>
        </div>

        <div className="row" style={{ gap: 18 }}>
          <div className="score num">{right}<small>/{block.length}</small></div>
          <div className="blips grow">
            {block.map((b, i) => (
              <span key={i} className={`blip ${b.chosen === b.q.c ? 'ok' : 'no'}`}>{b.chosen === b.q.c ? '✓' : '✕'}</span>
            ))}
          </div>
        </div>

        <p className="t-sub" style={{ margin: 0 }}>{verdict}</p>

        <div className="kpis four">
          <Kpi value={`${session.correct}/${session.answered}`} label={t.thisSession} />
          <Kpi value={lifetime.attempts ? pct(lifeAcc) : '—'} label={t.allTime} />
          <Kpi value={bestStreak} label={t.streak} />
          <Kpi value={avgSeconds > 0 ? `${avgSeconds}s` : '<1s'} label={t.avgTime} />
        </div>

        <div className="card tonal p12">
          <div className="t-over">{t.projected}</div>
          <div className="row">
            <b className="t-title num grow">~{projected} {t.wrongCount} / {TEST_LEN}</b>
            <span className={`chip ${passing ? 'ok' : 'bad'}`}>{passing ? t.pass : t.fail}</span>
          </div>
          <div className="t-cap">{t.projectedHint} · {t.allowed}</div>
        </div>

        {topicRows.length > 1 && (
          <>
            <div className="t-over">{t.byTopic}</div>
            <div className="stack" style={{ gap: 8 }}>
              {topicRows.map(([k, v]) => (
                <div className="row" key={k} style={{ gap: 8 }}>
                  <span aria-hidden style={{ width: 22 }}>{topicIcon(k)}</span>
                  <span className="t-body grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {topicName(k, lang)}
                  </span>
                  <span style={{ width: 74 }}>
                    <Linear value={v.ok / v.n} tone={v.ok === v.n ? 'ok' : v.ok / v.n < 0.7 ? 'bad' : ''} />
                  </span>
                  <b className="t-label num" style={{ width: 34, textAlign: 'right' }}>{v.ok}/{v.n}</b>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="card p16">
        <h3 className="t-sub" style={{ marginBottom: 6 }}>{wrong.length ? t.missedHere : t.allRight}</h3>
        <MissedList t={t} lang={lang} items={block} />
      </div>

      <div className="action-bar">
        <div className="action-bar-in">
          <button className="btn tonal" onClick={onHome}>⌂</button>
          {wrong.length > 0 && <button className="btn tonal" onClick={onDrill}>{t.drillThese}</button>}
          {isFinal
            ? <button className="btn grow lg" onClick={onHome}>{t.backHome}</button>
            : <button className="btn grow lg" onClick={onContinue}>{t.keepGoing} →</button>}
        </div>
      </div>
    </div>
  )
}
