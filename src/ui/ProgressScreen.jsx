import React, { useState } from 'react'
import { TOPICS, topicName, topicIcon } from '../lib/topics.js'
import { Ring, Linear, Kpi, Confirm, pct } from './bits.jsx'
import { badgeFor, badgeSummary, TIERS } from '../state/badges.js'
import { daysLeft, projectedErrors, TEST_LEN, TEST_MAX_ERRORS, RETENTION_DAYS } from '../state/store.js'

export default function ProgressScreen({ t, lang, state, summary, onReset }) {
  const [confirm, setConfirm] = useState(false)
  const rated = TOPICS.map((tp) => ({ ...tp, ...(summary.byTopic[tp.key] || {}) })).filter((r) => r.attempts)
  const weakest = [...rated]
    .filter((r) => r.attempts >= 5 && r.accuracy < 0.9)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3)
  const bs = badgeSummary(state.sectionBest, TOPICS)
  const projected = projectedErrors(summary.accuracy)
  const left = daysLeft(state)

  return (
    <div className="stack lg fade">
      <div className="card p16 stack">
        <div className="row" style={{ gap: 16 }}>
          <Ring value={summary.coverage} size={96} stroke={10} label={pct(summary.coverage)} sub={t.coverage} />
          <div className="grow stack" style={{ gap: 8 }}>
            <div>
              <div className="t-over">{t.overall}</div>
              <b className="t-title num">{summary.mastered} / {summary.total}</b>
            </div>
            {summary.attempts >= 10 && (
              <div className="row" style={{ gap: 8 }}>
                <span className={`chip ${projected <= TEST_MAX_ERRORS ? 'ok' : projected <= 5 ? 'warn' : 'bad'}`}>
                  {projected <= TEST_MAX_ERRORS ? t.pass : t.fail}
                </span>
                <span className="t-cap">~{projected} {t.wrongCount} / {TEST_LEN}</span>
              </div>
            )}
          </div>
        </div>
        <div className="kpis four">
          <Kpi value={summary.seen} label={t.seen} />
          <Kpi value={summary.attempts} label={t.answered} />
          <Kpi value={summary.attempts ? pct(summary.accuracy) : '—'} label={t.accuracy} />
          <Kpi value={state.totals.bestStreak || 0} label={t.streak} />
        </div>
        {!summary.attempts && <p className="t-cap" style={{ margin: 0 }}>{t.noData}</p>}
      </div>

      <div className="card p16 stack">
        <div className="row">
          <h3 className="t-sub grow">{t.badges}</h3>
          <span className="t-cap">{t.badgesSub(bs.earned, bs.total)}</span>
        </div>
        <div className="badgegrid">
          {TOPICS.map((tp) => {
            const b = badgeFor(state.sectionBest, tp.key)
            return (
              <div className={`bcell${b ? ' on' : ''}`} key={tp.key}>
                <div className="bi">{b ? b.icon : '🔒'}</div>
                <div className="bn">{topicName(tp.key, lang)}</div>
                {b && <div className="t-cap num">{b.best}/{b.outOf}</div>}
              </div>
            )
          })}
        </div>
        <div className="t-cap">
          {TIERS.map((x) => `${x.icon} ${x[lang] || x.en} ${Math.ceil(x.min * 30)}+`).reverse().join('  ·  ')}
        </div>
      </div>

      <div className="card p16 stack">
        <div className="row">
          <h3 className="t-sub grow">{t.byTopic}</h3>
          <span className="t-cap">{t.legendBar}</span>
        </div>
        <div className="stack" style={{ gap: 10 }}>
          {TOPICS.map((tp) => {
            const r = summary.byTopic[tp.key] || { total: 0, mastered: 0, accuracy: null, coverage: 0 }
            return (
              <div className="row" key={tp.key} style={{ gap: 8 }}>
                <span aria-hidden style={{ width: 22 }}>{tp.icon}</span>
                <span className="t-body grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {topicName(tp.key, lang)}
                </span>
                <span style={{ width: 84 }}>
                  <Linear value={r.coverage} tone={r.coverage >= 0.8 ? 'ok' : ''} />
                </span>
                <b className="t-label num" style={{ width: 52, textAlign: 'right' }}>
                  {r.accuracy == null ? `0/${r.total}` : pct(r.accuracy)}
                </b>
              </div>
            )
          })}
        </div>
        {weakest.length > 0 && (
          <>
            <hr className="sep" />
            <div className="t-over">{t.weakest}</div>
            <div className="row wrap" style={{ gap: 6 }}>
              {weakest.map((r) => (
                <span className="chip bad" key={r.key}>{r.icon} {topicName(r.key, lang)} {pct(r.accuracy)}</span>
              ))}
            </div>
          </>
        )}
      </div>

      {state.sessions.length > 0 && (
        <div className="card p16 stack">
          <h3 className="t-sub">{t.history}</h3>
          <div className="stack" style={{ gap: 10 }}>
            {state.sessions.slice(0, 10).map((s, i) => (
              <div className="row" key={i} style={{ gap: 8 }}>
                <span aria-hidden style={{ width: 22 }}>{s.mode === 'test' ? '📝' : '📚'}</span>
                <span className="t-cap grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {new Date(s.ts).toLocaleDateString()} {new Date(s.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  {s.scope?.type === 'topic' ? ` · ${topicName(s.scope.key, lang)}` : ''}
                </span>
                <span style={{ width: 70 }}>
                  <Linear value={s.total ? s.correct / s.total : 0} tone={s.total && s.correct / s.total >= 0.9 ? 'ok' : ''} />
                </span>
                <b className="t-label num" style={{ width: 44, textAlign: 'right' }}>{s.correct}/{s.total}</b>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card flat p16 stack">
        <h3 className="t-sub">{t.device}</h3>
        <p className="t-cap" style={{ margin: 0 }}>{t.deviceSub}</p>
        <div className="card tonal p12 stack" style={{ gap: 6 }}>
          <div className="row">
            <span className="t-cap grow">{t.deviceId}</span>
            <code className="t-label num" style={{ letterSpacing: '.02em' }}>{String(state.deviceId).slice(0, 8)}</code>
          </div>
          <div className="row">
            <span className="t-cap grow">{t.expiresIn(left)}</span>
            <span className="t-cap num">{RETENTION_DAYS}d</span>
          </div>
          <Linear value={left / RETENTION_DAYS} className="thin" />
        </div>
        <button className="btn danger block" onClick={() => setConfirm(true)}>{t.reset}</button>
      </div>

      <Confirm
        open={confirm}
        text={t.resetConfirm}
        confirmLabel={t.reset}
        cancelLabel={t.cancel}
        danger
        onCancel={() => setConfirm(false)}
        onConfirm={() => { setConfirm(false); onReset() }}
      />
    </div>
  )
}
