import React from 'react'
import { imgUrl } from '../lib/data.js'

const KEYS = ['A', 'B', 'C', 'D']

export default function MissedList({ t, lang, items, showCorrect = false }) {
  return (
    <>
      {items.map(({ q, chosen }) => {
        const body = q[lang] || q.en
        const ok = chosen === q.c
        if (ok && !showCorrect) return null
        return (
          <div className="missed" key={q.i}>
            {q.img && <img className="th" src={imgUrl(q.img)} alt="" width="76" height="56" loading="lazy" decoding="async"
                 onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />}
            <div className="mb">
              <div className="mq">{body.q}</div>
              <div className="ml" style={{ color: ok ? 'var(--success)' : 'var(--error)' }}>
                {ok ? '✓' : '✕'} {t.yourAnswer}: {chosen == null ? t.notAnswered : `${KEYS[chosen]}. ${body.o[chosen]}`}
              </div>
              {!ok && (
                <div className="ml" style={{ color: 'var(--success)' }}>
                  ✓ {KEYS[q.c]}. {body.o[q.c]}
                </div>
              )}
              <div className="ml muted" style={{ marginTop: 6 }}>
                <span className="t-over">{t.why}</span>
                {body.e}
              </div>
            </div>
          </div>
        )
      })}
    </>
  )
}
