import React from 'react'

export const pct = (x) => `${Math.round((x || 0) * 100)}%`

export function Linear({ value, tone = '', className = '' }) {
  const v = Math.max(0, Math.min(1, value || 0))
  return (
    <div className={`linear ${tone} ${className}`.trim()} role="progressbar" aria-valuenow={Math.round(v * 100)}>
      <i style={{ width: `${v * 100}%` }} />
    </div>
  )
}

export function Ring({ value, size = 92, stroke = 9, label, sub, tone = 'var(--primary)', track = 'var(--surface-3)' }) {
  const v = Math.max(0, Math.min(1, value || 0))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset .5s cubic-bezier(.2,.7,.3,1)' }}
        />
      </svg>
      <div className="ring-in">
        <b>{label ?? pct(v)}</b>
        {sub && <small>{sub}</small>}
      </div>
    </div>
  )
}

export const Kpi = ({ value, label }) => (
  <div className="kpi">
    <b className="num">{value}</b>
    <span>{label}</span>
  </div>
)

export function Item({ icon, title, sub, tail, onClick, disabled }) {
  return (
    <button className="item" onClick={onClick} disabled={disabled} style={disabled ? { opacity: 0.5 } : undefined}>
      {icon != null && <span className="lead" aria-hidden>{icon}</span>}
      <span className="body">
        <b>{title}</b>
        {sub && <span className="sub">{sub}</span>}
      </span>
      {tail != null && <span className="tail">{tail}</span>}
    </button>
  )
}

export function Sheet({ open, onClose, children }) {
  if (!open) return null
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true">
        <div className="grab" />
        {children}
      </div>
    </>
  )
}

export function Confirm({ open, text, confirmLabel, cancelLabel, onConfirm, onCancel, danger }) {
  if (!open) return null
  return (
    <>
      <div className="scrim" onClick={onCancel} />
      <div className="sheet" role="alertdialog" aria-modal="true">
        <div className="grab" />
        <p className="t-sub" style={{ margin: '4px 0 18px' }}>{text}</p>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn tonal grow" onClick={onCancel}>{cancelLabel}</button>
          <button className={`btn grow${danger ? ' danger' : ''}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </>
  )
}

export const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, s % 60)).padStart(2, '0')}`
