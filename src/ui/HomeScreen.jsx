import React, { useState } from 'react'
import { TOPICS, topicName } from '../lib/topics.js'
import { Ring, Linear, Kpi, Item, Sheet, pct } from './bits.jsx'
import { badgeFor } from '../state/badges.js'
import { TEST_LEN } from '../state/store.js'

export default function HomeScreen({ t, lang, summary, mistakes, session, sectionBest, onStart, onResume, counts }) {
  const [sheet, setSheet] = useState(null) // topic key

  const topic = sheet ? TOPICS.find((x) => x.key === sheet) : null
  const topicCount = topic ? counts[topic.key] || 0 : 0

  return (
    <div className="stack lg fade">
      <div className="card pri p16 stack">
        <div className="row" style={{ gap: 16 }}>
          <Ring
            value={summary.coverage}
            size={92}
            stroke={9}
            tone="#fff"
            track="rgba(255,255,255,.28)"
            label={pct(summary.coverage)}
          />
          <div className="grow">
            <div className="t-over">{t.yourProgress}</div>
            <div className="t-title num" style={{ margin: '2px 0 6px' }}>
              {summary.mastered} <span style={{ opacity: .8, fontWeight: 600 }}>/ {summary.total}</span>
            </div>
            <Linear value={summary.coverage} className="onpri" />
            <div className="t-cap" style={{ marginTop: 8 }}>
              {summary.attempts ? `${pct(summary.accuracy)} ${t.accuracy.toLowerCase()} · ${summary.seen} ${t.seen.toLowerCase()}` : t.freshStart}
            </div>
          </div>
        </div>
        {session ? (
          <button className="btn lg block" style={{ background: '#fff', color: 'var(--primary)' }} onClick={onResume}>
            ▶ {t.continueStudy}
          </button>
        ) : (
          <button
            className="btn lg block"
            style={{ background: '#fff', color: 'var(--primary)' }}
            onClick={() => onStart({ mode: 'study', order: 'seq', scope: { type: 'all' } })}
          >
            ▶ {summary.attempts ? t.continueStudy : t.startStudy}
          </button>
        )}
        {session && (
          <div className="t-cap center">{t.resumeAt(Math.min(session.idx + 1, session.queue.length), session.queue.length)}</div>
        )}
      </div>

      <div className="list">
        <Item
          icon="⚡"
          title={t.quickPractice}
          sub={t.quickPracticeSub}
          tail="›"
          onClick={() => onStart({ mode: 'study', order: 'random', length: 20, scope: { type: 'all' } })}
        />
        <Item
          icon="🎯"
          title={t.weakFirst}
          sub={t.weakFirstSub}
          tail="›"
          onClick={() => onStart({ mode: 'study', order: 'weak', length: 30, scope: { type: 'all' } })}
        />
        <Item
          icon="🔁"
          title={t.drillMistakes}
          sub={mistakes.length ? t.drillMistakesSub(mistakes.length) : t.noMistakes}
          tail={mistakes.length ? String(mistakes.length) : '—'}
          disabled={!mistakes.length}
          onClick={() => onStart({ mode: 'study', order: 'random', scope: { type: 'mistakes' } })}
        />
      </div>

      <div className="sec-head">
        <h3 className="grow">{t.sections}</h3>
        <span className="t-cap">{t.sectionsPick}</span>
      </div>

      <div className="list">
        {TOPICS.map((tp) => {
          const st = summary.byTopic[tp.key] || { total: 0, mastered: 0, accuracy: null, coverage: 0 }
          const badge = badgeFor(sectionBest, tp.key)
          return (
            <button className="item" key={tp.key} onClick={() => setSheet(tp.key)}>
              <span className="lead" aria-hidden>{tp.icon}</span>
              <span className="body">
                <b>{topicName(tp.key, lang)}</b>
                <span className="sub">{st.mastered}/{st.total} {t.mastered.toLowerCase()}</span>
                <span style={{ display: 'block', marginTop: 6 }}>
                  <Linear value={st.coverage} className="thin" tone={st.coverage >= 0.8 ? 'ok' : ''} />
                </span>
              </span>
              <span className="tail">
                {badge ? <span title={`${badge.best}/${badge.outOf}`}>{badge.icon}</span> : null}
                <span>›</span>
              </span>
            </button>
          )
        })}
      </div>

      <Sheet open={!!topic} onClose={() => setSheet(null)}>
        {topic && (
          <div className="stack">
            <div className="row">
              <span className="lead" aria-hidden style={{ fontSize: 24 }}>{topic.icon}</span>
              <div className="grow">
                <h3 className="t-title">{topicName(topic.key, lang)}</h3>
                <div className="t-cap">{topicCount} {t.questions}</div>
              </div>
            </div>
            <button
              className="btn block lg"
              onClick={() => { setSheet(null); onStart({ mode: 'study', order: 'seq', scope: { type: 'topic', key: topic.key } }) }}
            >
              📚 {t.learn}
            </button>
            <button
              className="btn tonal block lg"
              onClick={() => { setSheet(null); onStart({ mode: 'test', scope: { type: 'topic', key: topic.key } }) }}
            >
              📝 {t.sectionTest}
            </button>
            <p className="t-cap center" style={{ margin: 0 }}>
              {t.learnSub(topicCount)} · {t.sectionTestSub}
            </p>
            {(() => {
              const b = badgeFor(sectionBest, topic.key)
              const rec = sectionBest?.[topic.key]
              return (
                <div className="card tonal p12 row">
                  <div className="grow">
                    <div className="t-over">{t.best}</div>
                    <b className="num">{rec?.best != null && rec.attempts ? `${rec.best}/${rec.outOf || TEST_LEN}` : t.noAttempt}</b>
                  </div>
                  {b && <span style={{ fontSize: 26 }}>{b.icon}</span>}
                </div>
              )
            })()}
            <button className="btn text block" onClick={() => setSheet(null)}>{t.close}</button>
          </div>
        )}
      </Sheet>
    </div>
  )
}
