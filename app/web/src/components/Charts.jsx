// Hand-drawn SVG charts (no chart library). They only DRAW numbers the API computed.
import { day } from '../format.js'

const W = 760
const PAD = { l: 52, r: 86, t: 18, b: 34 }

function scale(lo, hi, a, b) {
  const span = hi - lo || 1
  return (v) => a + ((v - lo) / span) * (b - a)
}

function Axis({ y, ticks, fmt = (v) => v }) {
  return (
    <g className="axis">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="grid" />
          <text x={PAD.l - 6} y={y(t) + 4} textAnchor="end">
            {fmt(t)}
          </text>
        </g>
      ))}
    </g>
  )
}

function niceTicks(lo, hi, n = 5) {
  const step = Math.pow(10, Math.floor(Math.log10((hi - lo) / n || 1)))
  const s = [1, 2, 5, 10].map((m) => m * step).find((st) => (hi - lo) / st <= n) || step * 10
  const out = []
  for (let v = Math.ceil(lo / s) * s; v <= hi + 1e-9; v += s) out.push(+v.toFixed(6))
  return out
}

function HLine({ y, v, label, cls, x1 = PAD.l, x2 = W - PAD.r }) {
  return (
    <g className={cls}>
      <line x1={x1} x2={x2} y1={y(v)} y2={y(v)} />
      <text x={x2 + 4} y={y(v) + 4}>
        {label}
      </text>
    </g>
  )
}

/**
 * Individuals (I) chart: steelblue +/-3 s control band from the baseline, dashed red spec limits,
 * grey baseline region, points coloured by what they mean.
 */
export function ControlChart({ series, limits, spec, hits, height = 300 }) {
  const H = height
  const xs = series.temp_c
  const n = xs.length
  const specVals = [spec.lower, spec.upper].filter((v) => v !== null && v !== undefined)
  let lo = Math.min(limits.lower, ...xs, ...specVals)
  let hi = Math.max(limits.upper, ...xs, ...specVals)
  const padY = (hi - lo) * 0.08
  lo -= padY
  hi += padY
  const x = scale(0, n - 1, PAD.l, W - PAD.r)
  const y = scale(lo, hi, H - PAD.b, PAD.t)
  const ruleAt = new Map()
  hits.forEach((h) => ruleAt.set(h.index, [...(ruleAt.get(h.index) || []), h.rule]))
  const baseEnd = series.baseline.lastIndexOf(true)
  const outOfSpec = (v) => (spec.lower !== null && spec.lower !== undefined && v < spec.lower) || v > spec.upper
  const path = xs.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const dayTicks = series.timestamp
    .map((t, i) => [t, i])
    .filter(([t, i]) => i % 30 === 0)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Individuals control chart">
      <rect x={PAD.l} width={x(baseEnd) - PAD.l} y={PAD.t} height={H - PAD.t - PAD.b} className="baseline" />
      <text x={PAD.l + 6} y={PAD.t + 14} className="baseline-label">
        baseline (sets the control limits)
      </text>
      <Axis y={y} ticks={niceTicks(lo, hi)} />
      <rect
        x={PAD.l}
        width={W - PAD.l - PAD.r}
        y={y(limits.upper)}
        height={y(limits.lower) - y(limits.upper)}
        className="band grow"
        style={{ transformOrigin: `0 ${(y(limits.upper) + y(limits.lower)) / 2}px` }}
      />
      <HLine y={y} v={limits.upper} label="+3 s" cls="limit" />
      <HLine y={y} v={limits.xbar} label="x̄" cls="center" />
      <HLine y={y} v={limits.lower} label="−3 s" cls="limit" />
      {specVals.map((v) => (
        <HLine key={v} y={y} v={v} label={`spec ${v}`} cls="spec" />
      ))}
      <path d={path} className="series draw" pathLength="1" />
      {xs.map((v, i) => {
        const cls = outOfSpec(v) ? 'pt excursion' : ruleAt.has(i) && !series.baseline[i] ? 'pt signal' : 'pt'
        return (
          <circle key={i} cx={x(i)} cy={y(v)} r={cls === 'pt' ? 2.2 : 3.6} className={`${cls} pop`} style={{ animationDelay: `${0.2 + (i / n) * 1.3}s` }}>
            <title>{`${day(series.timestamp[i])} ${new Date(series.timestamp[i]).getHours()}:00 — ${v.toFixed(1)} °C${
              ruleAt.has(i) ? ` — rule ${ruleAt.get(i).join(', ')}` : ''
            }`}</title>
          </circle>
        )
      })}
      {dayTicks.map(([t, i]) => (
        <text key={i} x={x(i)} y={H - 10} className="xtick" textAnchor="middle">
          {day(t)}
        </text>
      ))}
    </svg>
  )
}

/** Moving range chart: |x_t - x_(t-1)| with its D4 * mRbar upper limit. */
export function MRChart({ series, limits, height = 170 }) {
  const H = height
  const mr = series.mr.map((v) => (v === null ? null : v))
  const vals = mr.filter((v) => v !== null)
  const hi = Math.max(limits.mr_upper, ...vals) * 1.1
  const x = scale(0, mr.length - 1, PAD.l, W - PAD.r)
  const y = scale(0, hi, H - PAD.b, PAD.t)
  const path = mr
    .map((v, i) => (v === null ? '' : `${i <= 1 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`))
    .join('')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Moving range chart">
      <Axis y={y} ticks={niceTicks(0, hi, 3)} />
      <HLine y={y} v={limits.mr_upper} label="D4·mR̄" cls="limit" />
      <HLine y={y} v={limits.mrbar} label="mR̄" cls="center" />
      <path d={path} className="series mr draw" pathLength="1" />
      {mr.map((v, i) =>
        v !== null && v > limits.mr_upper ? <circle key={i} cx={x(i)} cy={y(v)} r={3.5} className="pt signal" /> : null
      )}
    </svg>
  )
}

/** p chart of failed generator starts per quarter, with per-quarter (stepped) limits. */
export function PChart({ pc, height = 240 }) {
  const H = height
  const n = pc.period.length
  const hi = Math.min(1, Math.max(...pc.upper, ...pc.p, 0.1) * 1.1)
  const x = scale(-0.5, n - 0.5, PAD.l, W - PAD.r)
  const y = scale(0, hi, H - PAD.b, PAD.t)
  const step = pc.upper.map((u, i) => `${i ? 'L' : 'M'}${x(i - 0.5)},${y(u)}H${x(i + 0.5)}`).join('')
  const firstJudged = pc.baseline.indexOf(false)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="p chart of failed starts">
      {firstJudged > 0 ? (
        <>
          <rect x={x(firstJudged - 0.5)} width={x(n - 0.5) - x(firstJudged - 0.5)} y={PAD.t} height={H - PAD.t - PAD.b} className="judged" />
          <text x={x(firstJudged - 0.5) - 4} y={PAD.t + 12} textAnchor="end" className="baseline-label">
            baseline sets p̄ ←
          </text>
        </>
      ) : null}
      <Axis y={y} ticks={niceTicks(0, hi, 4)} fmt={(v) => `${Math.round(v * 100)}%`} />
      <path d={step} className="limit-step" />
      <HLine y={y} v={pc.pbar} label="p̄" cls="center" />
      <text x={W - PAD.r + 4} y={y(pc.upper[n - 1]) + 4} className="limit-label">
        upper
      </text>
      <path d={pc.p.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('')} className="series draw" pathLength="1" />
      {pc.p.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={pc.signal[i] ? 4.5 : 2.5} className={`${pc.signal[i] ? 'pt excursion' : 'pt'} pop`} style={{ animationDelay: `${0.2 + (i / n) * 1.3}s` }}>
          <title>{`${pc.period[i]}: ${pc.failures[i]} failed of ${pc.demands[i]} (${(v * 100).toFixed(0)}%)`}</title>
        </circle>
      ))}
      {pc.period.map((m, i) =>
        i % 2 === 0 || i === n - 1 ? (
          <text key={m} x={x(i)} y={H - 10} className="xtick" textAnchor="middle">
            {m}
          </text>
        ) : null
      )}
    </svg>
  )
}

/** R(t) curve with its lower confidence bound, the backup-branch curve and the planning outage. */
export function ReliabilityChart({ curve, outageHours, height = 260 }) {
  const H = height
  const x = scale(0, curve.hours[curve.hours.length - 1], PAD.l, W - PAD.r)
  const y = scale(0, 1, H - PAD.b, PAD.t)
  const line = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(curve.hours[i])},${y(v)}`).join('')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Reliability over outage length">
      <Axis y={y} ticks={[0, 0.25, 0.5, 0.75, 1]} fmt={(v) => v.toFixed(2)} />
      <line x1={x(outageHours)} x2={x(outageHours)} y1={PAD.t} y2={H - PAD.b} className="marker" />
      <text x={x(outageHours) + 4} y={PAD.t + 12} className="marker-label">
        {outageHours} h outage
      </text>
      <path d={line(curve.R)} className="series rel draw" pathLength="1" />
      <path d={line(curve.R_lower)} className="series rel-lower fade-in" />
      <path d={line(curve.backup)} className="series backup draw" pathLength="1" style={{ animationDelay: '0.3s' }} />
      <g className="legend" transform={`translate(${W - PAD.r + 6}, ${PAD.t + 10})`}>
        <text className="rel">R(t)</text>
        <text y={16} className="rel-lower">
          95% low
        </text>
        <text y={32} className="backup">
          p·R(t)
        </text>
      </g>
      {[0, 12, 24, 36, 48, 60, 72].map((h) => (
        <text key={h} x={x(h)} y={H - 10} className="xtick" textAnchor="middle">
          {h} h
        </text>
      ))}
    </svg>
  )
}

/** Reliability block diagram: grid power in parallel with (generator starts -> runs t hours). */
export function BlockDiagram({ pStart, rRun, pBackup, outageHours }) {
  return (
    <svg viewBox="0 0 760 186" className="chart block" role="img" aria-label="Reliability block diagram">
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0,0L10,5L0,10z" className="arrowhead" />
        </marker>
      </defs>
      <circle cx="40" cy="85" r="16" className="node" />
      <text x="40" y="90" textAnchor="middle" className="node-label">
        ⚡
      </text>
      <path d="M56,85 L90,85 L90,40 L130,40" className="wire flow" markerEnd="url(#arrow)" />
      <path d="M90,85 L90,130 L130,130" className="wire flow" markerEnd="url(#arrow)" />
      <rect x="130" y="20" width="370" height="40" rx="8" className="box grid-box" />
      <text x="315" y="45" textAnchor="middle">
        Grid power (down during a blackout)
      </text>
      <rect x="130" y="110" width="170" height="40" rx="8" className="box" />
      <text x="215" y="128" textAnchor="middle">
        Generator starts
      </text>
      <text x="215" y="143" textAnchor="middle" className="box-num">
        p = {pStart.toFixed(3)}
      </text>
      <path d="M300,130 L330,130" className="wire flow" markerEnd="url(#arrow)" />
      <rect x="330" y="110" width="170" height="40" rx="8" className="box" />
      <text x="415" y="128" textAnchor="middle">
        Runs {outageHours} h
      </text>
      <text x="415" y="143" textAnchor="middle" className="box-num">
        R(t) = {rRun.toFixed(3)}
      </text>
      <path d="M500,40 L560,40 L560,85 L600,85" className="wire grid-wire" />
      <path d="M500,130 L560,130 L560,85" className="wire flow" />
      <path d="M600,85 L640,85" className="wire flow" markerEnd="url(#arrow)" />
      <circle cx="660" cy="85" r="18" className="node cold" />
      <text x="660" y="90" textAnchor="middle" className="node-label">
        ❄
      </text>
      <text x="315" y="178" textAnchor="middle" className="box-num">
        backup branch (series): {pStart.toFixed(3)} × {rRun.toFixed(3)} = {pBackup.toFixed(3)}
      </text>
    </svg>
  )
}
