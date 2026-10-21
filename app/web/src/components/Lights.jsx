// Visual status: an equipment "light board" and tiny sparklines. Display only; no statistics.

const TONE = { Normal: 'good', Warning: 'warn', Critical: 'bad', Review: 'review' }

/** A row of status lights, one per unit and generator: green glows, amber blinks, red flashes. */
export function LightBoard({ items, onPick }) {
  const counts = items.reduce((a, it) => ({ ...a, [it.status]: (a[it.status] || 0) + 1 }), {})
  return (
    <div className="lightboard">
      <div className="lb-legend">
        {['Critical', 'Warning', 'Review', 'Normal'].map((s) =>
          counts[s] ? (
            <span key={s} className={`lb-count ${TONE[s]}`}>
              <i className={`led-dot ${TONE[s]}`} /> {counts[s]} {s}
            </span>
          ) : null
        )}
      </div>
      <div className="lb-grid">
        {items.map((it, i) => (
          <button key={it.id} className={`lb-cell ${TONE[it.status]}`} onClick={() => onPick(it)} title={`${it.id}: ${it.reason}`} style={{ '--i': i }}>
            <span className={`led ${TONE[it.status]}`}>
              <span className="led-core" />
              {it.status === 'Critical' ? <span className="siren" /> : null}
            </span>
            <b>{it.id}</b>
            <small>{it.kind}</small>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Tiny temperature trace with the spec band, coloured by status. */
export function Sparkline({ values, lower, upper, status, width = 96, height = 30 }) {
  if (!values || values.length < 2) return null
  const lims = [lower, upper].filter((v) => v !== null && v !== undefined)
  const lo = Math.min(...values, ...lims)
  const hi = Math.max(...values, ...lims)
  const span = hi - lo || 1
  const x = (i) => (i / (values.length - 1)) * width
  const y = (v) => height - 2 - ((v - lo) / span) * (height - 4)
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const out = (v) => (lower !== null && lower !== undefined && v < lower) || (upper !== null && upper !== undefined && v > upper)
  return (
    <svg className={`spark ${TONE[status] || ''}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {lims.map((v) => (
        <line key={v} x1="0" x2={width} y1={y(v)} y2={y(v)} className="spark-spec" />
      ))}
      <path d={d} className="spark-line" pathLength="1" />
      {values.map((v, i) => (out(v) ? <circle key={i} cx={x(i)} cy={y(v)} r="1.8" className="spark-bad" /> : null))}
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="2.6" className="spark-end" />
    </svg>
  )
}

/** Mini bars: failed-start fraction per quarter, signals in red. */
export function SparkBars({ values, signals, status, width = 96, height = 30 }) {
  if (!values?.length) return null
  const max = Math.max(...values, 0.05)
  const bw = width / values.length
  return (
    <svg className={`spark ${TONE[status] || ''}`} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      {values.map((v, i) => {
        const h = Math.max(1.5, (v / max) * (height - 2))
        return <rect key={i} x={i * bw + 1} y={height - h} width={bw - 2} height={h} rx="1" className={signals[i] ? 'spark-bar bad' : 'spark-bar'} />
      })}
    </svg>
  )
}
