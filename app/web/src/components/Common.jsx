import AnimatedNumber from './AnimatedNumber.jsx'

export function Pill({ status }) {
  return <span className={`pill ${String(status).toLowerCase()}`}>{status}</span>
}

const ICON = { Normal: '✓', Warning: '⚠', Critical: '⚡', Review: '?' }

export function StatusRow({ id, title, reason, status, onClick, active, i = 0 }) {
  return (
    <button className={`status-row ${active ? 'active' : ''} s-${String(status).toLowerCase()}`} onClick={onClick} style={{ '--i': i }}>
      <span className={`icon ${String(status).toLowerCase()}`}>{ICON[status] || '•'}</span>
      <span className="status-text">
        <b>
          {id}
          {title ? <span className="muted"> · {title}</span> : null}
        </b>
        <small>{reason}</small>
      </span>
      <Pill status={status} />
    </button>
  )
}

/** A stat tile. Pass `num` (+ optional `fmt`) to count up, or `value` for plain text. */
export function Tile({ label, value, num, fmt, note, tone }) {
  return (
    <div className={`tile ${tone || ''}`} data-fx>
      <div className="tile-label">{label}</div>
      <div className="tile-value">{num !== undefined ? <AnimatedNumber value={num} format={fmt} /> : value}</div>
      {note ? <div className="tile-note">{note}</div> : null}
    </div>
  )
}

export function HowToRead({ children }) {
  return (
    <p className="how">
      <b>How to read this:</b> {children}
    </p>
  )
}

export function Section({ title, kicker, children, right, className = '' }) {
  return (
    <section className={`card ${className}`} data-fx>
      <header className="card-head">
        <div>
          {kicker ? <div className="kicker">{kicker}</div> : null}
          <h2>{title}</h2>
        </div>
        {right}
      </header>
      {children}
    </section>
  )
}
