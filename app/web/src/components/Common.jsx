export function Pill({ status }) {
  return <span className={`pill ${String(status).toLowerCase()}`}>{status}</span>
}

const ICON = { Normal: '✓', Warning: '⚠', Critical: '⚡', Review: '?' }

export function StatusRow({ id, title, reason, status, onClick, active }) {
  return (
    <button className={`status-row ${active ? 'active' : ''}`} onClick={onClick}>
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

export function Tile({ label, value, note, tone }) {
  return (
    <div className={`tile ${tone || ''}`}>
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
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

export function Section({ title, kicker, children, right }) {
  return (
    <section className="card">
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
