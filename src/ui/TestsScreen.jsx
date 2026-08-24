import React from 'react'
import { TOPICS, topicName } from '../lib/topics.js'
import { Item, Linear } from './bits.jsx'
import { badgeFor } from '../state/badges.js'
import { TEST_LEN, TEST_MAX_ERRORS } from '../state/store.js'

export default function TestsScreen({ t, lang, sectionBest, onStart, counts }) {
  const full = sectionBest?.__full
  const fullBadge = badgeFor(sectionBest, '__full')

  return (
    <div className="stack lg fade">
      <div className="card pri p16 stack">
        <div className="row">
          <div className="grow">
            <div className="t-over">{t.mockExam}</div>
            <h2 className="t-title">{TEST_LEN} {t.questions}</h2>
            <div className="t-cap">{t.mockExamSub}</div>
          </div>
          {fullBadge && <span style={{ fontSize: 30 }}>{fullBadge.icon}</span>}
        </div>
        {full?.attempts ? (
          <div className="t-cap">
            {t.best}: {full.best}/{full.outOf || TEST_LEN} · {t.attempts(full.attempts)}
          </div>
        ) : null}
        <button
          className="btn lg block"
          style={{ background: '#fff', color: 'var(--primary)' }}
          onClick={() => onStart({ mode: 'test', scope: { type: 'all' } })}
        >
          ▶ {t.begin}
        </button>
      </div>

      <div className="sec-head">
        <h3 className="grow">{t.sections}</h3>
        <span className="t-cap">{TEST_LEN} {t.questions} · {t.allowed}</span>
      </div>

      <div className="list">
        {TOPICS.map((tp) => {
          const rec = sectionBest?.[tp.key]
          const badge = badgeFor(sectionBest, tp.key)
          const n = counts[tp.key] || 0
          const size = Math.min(TEST_LEN, n)
          return (
            <button className="item" key={tp.key} onClick={() => onStart({ mode: 'test', scope: { type: 'topic', key: tp.key } })}>
              <span className="lead" aria-hidden>{tp.icon}</span>
              <span className="body">
                <b>{topicName(tp.key, lang)}</b>
                <span className="sub">
                  {rec?.attempts ? `${t.best} ${rec.best}/${rec.outOf || size} · ${t.attempts(rec.attempts)}` : `${size} ${t.questions} · ${t.noAttempt}`}
                </span>
                {rec?.attempts ? (
                  <span style={{ display: 'block', marginTop: 6 }}>
                    <Linear
                      value={rec.best / (rec.outOf || size)}
                      className="thin"
                      tone={rec.best >= (rec.outOf || size) - TEST_MAX_ERRORS ? 'ok' : ''}
                    />
                  </span>
                ) : null}
              </span>
              <span className="tail">
                {badge ? <span>{badge.icon}</span> : null}
                <span>›</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
