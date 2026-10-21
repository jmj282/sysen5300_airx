// Display helpers only. No statistics here: every number comes from the API.

export const num = (x, d = 2) => (x === null || x === undefined || Number.isNaN(x) ? '—' : Number(x).toFixed(d))
export const pct = (x, d = 1) => (x === null || x === undefined ? '—' : `${(100 * x).toFixed(d)}%`)
export const usd = (x) =>
  x === null || x === undefined ? '—' : x.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
export const temp = (x) => (x === null || x === undefined ? '—' : `${Number(x).toFixed(1)} °C`)
export const when = (iso) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' }) : '—'
export const day = (iso) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—')

export const specText = (spec) =>
  spec.lower === null || spec.lower === undefined ? `≤ ${spec.upper} °C` : `${spec.lower}–${spec.upper} °C`

export const STATUS_ORDER = { Critical: 0, Warning: 1, Review: 2, Normal: 3 }
