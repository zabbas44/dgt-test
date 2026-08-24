import React, { useEffect, useRef, useState } from 'react'
import { imgUrl } from '../lib/data.js'
import { topicName, topicIcon } from '../lib/topics.js'
import { Linear, fmtTime } from './bits.jsx'

const KEYS = ['A', 'B', 'C', 'D']

function Photo({ file }) {
  const [ok, setOk] = useState(true)
  if (!file || !ok) return null
  return <img className="qphoto" src={imgUrl(file)} alt="" onError={() => setOk(false)} />
}

export default function QuizScreen({
  t, lang, q, nextImg, index, total, mode, chosen, revealed,
  answers, correctness, timeLeft, onAnswer, onNext, onPrev, onJump, onExit, onSubmit,
}) {
  const body = q[lang] || q.en
  const isTest = mode === 'test'
  const top = useRef(null)

  useEffect(() => {
    // Bring the question into view on every change — on a phone the previous
    // answer list can leave the page scrolled halfway down.
    if (top.current) top.current.scrollIntoView({ block: 'start' })
    else window.scrollTo(0, 0)
  }, [q.i])

  // Desktop convenience: 1/2/3 (or A/B/C) answers, Enter moves on.
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      const n = 'abcd'.indexOf(k) >= 0 ? 'abcd'.indexOf(k) : '1234'.indexOf(k)
      if (n >= 0 && n < body.o.length && !revealed) { e.preventDefault(); onAnswer(n); return }
      if (e.key === 'Enter') {
        e.preventDefault()
        if (isTest || revealed) onNext()
      }
      if (e.key === 'ArrowLeft' && isTest) onPrev()
      if (e.key === 'ArrowRight' && isTest) onNext()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [body, revealed, isTest, onAnswer, onNext, onPrev])

  useEffect(() => {
    if (!nextImg) return
    const im = new Image()
    im.src = imgUrl(nextImg)
  }, [nextImg])

  const answeredCount = answers.filter((x) => x != null).length
  const left = total - answeredCount

  return (
    <div className="quiz">
      <div className="quiz-head">
        <div className="bar-row">
          <button className="icon-btn" onClick={onExit} aria-label={t.exit}>✕</button>
          <div className="grow">
            <div className="t-label num">{t.question} {index + 1} <span className="muted">/ {total}</span></div>
            <div className="t-cap">{topicIcon(q.t)} {topicName(q.t, lang)}</div>
          </div>
          {isTest && (
            <span className={`timer${timeLeft < 300 ? ' low' : ''}`}>⏱ {fmtTime(timeLeft)}</span>
          )}
        </div>
        <div className="prog-row">
          <Linear value={(isTest ? answeredCount : index + (revealed ? 1 : 0)) / total} className="thin" />
        </div>
        {isTest && (
          <div className="badgestrip">
            {answers.map((a, i) => (
              <button
                key={i}
                className={`qbadge${i === index ? ' now' : ''}${a != null && i !== index ? ' done' : ''}`}
                onClick={() => onJump(i)}
                aria-label={`${t.question} ${i + 1}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="qwrap" ref={top}>
        <div className={q.img ? 'qcols' : ''}>
          <Photo file={q.img} />
          <div>
            <h2 className="qtext">{body.q}</h2>
            <div className="opts">
              {body.o.map((opt, i) => {
                let cls = 'opt'
                if (revealed) {
                  if (i === q.c) cls += ' right'
                  else if (i === chosen) cls += ' wrong'
                } else if (i === chosen) cls += ' sel'
                return (
                  <button key={i} className={cls} disabled={revealed} onClick={() => onAnswer(i)}>
                    <span className="key">{KEYS[i]}</span>
                    <span>{opt}</span>
                  </button>
                )
              })}
            </div>

            {isTest && (
              <p className="t-cap" style={{ marginTop: 12 }}>{t.changeHint}</p>
            )}

            {revealed && (
              <div className={`feedback ${chosen === q.c ? 'ok' : 'bad'}`}>
                <div className="fh">{chosen === q.c ? `✓ ${t.correct}` : `✕ ${t.incorrect}`}</div>
                <div className="fb">
                  {chosen !== q.c && (
                    <div className="ans">
                      {t.correctAnswer}: {KEYS[q.c]}. {body.o[q.c]}
                    </div>
                  )}
                  <div className="t-over">{t.why}</div>
                  <div>{body.e}</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="quiz-foot">
        <div className="quiz-foot-in">
          {isTest ? (
            <>
              <button className="btn tonal" onClick={onPrev} disabled={index === 0} aria-label={t.prev}>←</button>
              <button className="btn tonal grow" onClick={onNext} disabled={index >= total - 1}>{t.next} →</button>
              <button className="btn" onClick={onSubmit}>
                {t.submit}{left ? ` · ${left} ${t.unanswered}` : ''}
              </button>
            </>
          ) : (
            <button className="btn block lg" onClick={onNext} disabled={!revealed}>
              {!revealed ? t.tapAnswer : (index + 1) % 10 === 0 || index + 1 >= total ? `${t.seeReview} →` : `${t.next} →`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
