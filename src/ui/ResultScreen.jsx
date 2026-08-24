import React, { useState } from 'react'
import { topicName, topicIcon } from '../lib/topics.js'
import { Linear, Kpi, Ring, pct, fmtTime } from './bits.jsx'
import MissedList from './MissedList.jsx'
import { TEST_MAX_ERRORS } from '../state/store.js'
import { tierFor } from '../state/badges.js'

export default function ResultScreen({ t, lang, items, seconds, scopeLabel, isNewBest, onHome, onRetake, onDrill }) {
  const [showAll, setShowAll] = useState(false)
  const right = items.filter((it) => it.chosen === it.q.c).length
  const errors = items.length - right
  const passed = errors <= TEST_MAX_ERRORS
  const tier = tierFor(right, items.length)

  const byTopic = {}
  for (const it of items) {
    const e = (byTopic[it.q.t] ||= { n: 0, ok: 0 })
    e.n++
    if (it.chosen === it.q.c) e.ok++
  }

  return (
    <div className="stack lg fade">
      <div className={`card p16 stack ${passed ? '' : ''}`}>
        <div className="row">
          <div className="grow">
            <h2 className="t-title">{scopeLabel || t.examResult}</h2>
            <div className="t-cap">{t.timeTaken}: {fmtTime(seconds)}</div>
          </div>
          <span className={`chip ${passed ? 'ok' : 'bad'}`} style={{ fontSize: 14, padding: '8px 14px' }}>
            {passed ? t.examPassed : t.examFailed}
          </span>
        </div>

        <div className="row" style={{ gap: 18 }}>
          <Ring
            value={right / items.length}
            size={104}
            stroke={10}
            label={`${right}/${items.length}`}
            tone={passed ? 'var(--success)' : 'var(--error)'}
          />
          <div className="grow stack" style={{ gap: 8 }}>
            <div className="row" style={{ gap: 8 }}>
              <b className="t-title num">{errors}</b>
              <span className="t-cap">{t.wrongCount} · {t.allowed}</span>
            </div>
            <Linear value={right / items.length} tone={passed ? 'ok' : 'bad'} />
            {tier && (
              <div className="row" style={{ gap: 8 }}>
                <span className="chip ok">{tier.icon} {tier[lang] || tier.en}</span>
                {isNewBest && <span className="chip pri">★ {t.newBest}</span>}
              </div>
            )}
          </div>
        </div>

        <div className="kpis four">
          <Kpi value={pct(right / items.length)} label={t.accuracy} />
          <Kpi value={right} label={t.correct} />
          <Kpi value={errors} label={t.wrongCount} />
          <Kpi value={items.filter((i) => i.chosen == null).length} label={t.notAnswered} />
        </div>

        <div className="stack" style={{ gap: 8 }}>
          {Object.entries(byTopic).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n).map(([k, v]) => (
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
      </div>

      <div className="card p16">
        <div className="row" style={{ marginBottom: 6 }}>
          <h3 className="t-sub grow">{showAll ? t.showAll : t.missedHere}</h3>
          <button className="btn text sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? t.hideAll : t.showAll}
          </button>
        </div>
        {errors === 0 && !showAll && <p className="t-cap" style={{ margin: 0 }}>{t.allRight}</p>}
        <MissedList t={t} lang={lang} items={items} showCorrect={showAll} />
      </div>

      <div className="action-bar">
        <div className="action-bar-in">
          <button className="btn tonal" onClick={onHome}>⌂</button>
          {errors > 0 && <button className="btn tonal" onClick={onDrill}>{t.drillThese}</button>}
          <button className="btn grow lg" onClick={onRetake}>{t.retake}</button>
        </div>
      </div>
    </div>
  )
}
