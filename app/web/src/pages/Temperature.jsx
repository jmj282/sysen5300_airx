import { ControlChart, MRChart } from '../components/Charts.jsx'
import { HowToRead, Pill, Section, StatusRow } from '../components/Common.jsx'
import { num, specText, temp, when } from '../format.js'

function Capability({ cap, recentPpk, spec }) {
  const rows = [
    ['Cp', 'capability, spread only', 'σ_short', cap.cp],
    ['Cpk', 'capability, spread + centring', 'σ_short', cap.cpk],
    ['Pp', 'performance, spread only', 'σ_total', cap.pp],
    ['Ppk', 'performance, spread + centring', 'σ_total', cap.ppk],
  ]
  return (
    <div className="cap">
      <table>
        <thead>
          <tr>
            <th>Index</th>
            <th>Meaning</th>
            <th>Sigma</th>
            <th>Estimate</th>
            <th>95% CI</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, m, s, v]) => (
            <tr key={k}>
              <td>
                <b>{k}</b>
              </td>
              <td>{m}</td>
              <td>{s}</td>
              <td className={v.estimate === null ? '' : v.estimate >= 1.33 ? 'good' : v.estimate >= 1 ? 'ok' : 'bad'}>
                {v.estimate === null ? 'n/a' : num(v.estimate)}
              </td>
              <td>{v.lower === null ? (spec.lower === null && (k === 'Cp' || k === 'Pp') ? 'one-sided spec' : '—') : `${num(v.lower)} – ${num(v.upper)}`}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={`verdict ${cap.baseline_stable ? '' : 'caution'}`}>
        <b>Verdict (baseline):</b> {cap.verdict}
      </p>
      <p className="muted small">
        Ppk over the last 7 days (actual recent performance): <b>{recentPpk === null ? '—' : num(recentPpk)}</b>. Benchmarks: 1.0 =
        spec just fits ±3σ; 1.33 = good. Capability assumes a stable process, so read the control chart first.
      </p>
    </div>
  )
}

export default function Temperature({ report, selected, select }) {
  const unit = report.units.find((u) => u.unit_id === selected) || report.units[0]
  const recentRules = [...new Set(unit.recent_hits.map((h) => h.rule))]
  return (
    <div className="grid-side">
      <Section title="Storage units" kicker="Pick a unit">
        <div className="status-list compact">
          {report.units.map((u) => (
            <StatusRow
              key={u.unit_id}
              id={u.unit_id}
              title={specText(u.spec)}
              reason={u.reason}
              status={u.status}
              active={u.unit_id === unit.unit_id}
              onClick={() => select(u.unit_id)}
            />
          ))}
        </div>
      </Section>

      <div className="stack">
        <Section
          kicker={`${unit.spec.label} · spec ${specText(unit.spec)} (${unit.spec.source})`}
          title={`${unit.unit_id}: Individuals (I) chart`}
          right={<Pill status={unit.status} />}
        >
          <p className="reason">{unit.reason}</p>
          {unit.lead_hours ? (
            <p className="lead">
              ⏱ The run rules flagged this unit <b>{Math.round(unit.lead_hours)} hours</b> ({(unit.lead_hours / 24).toFixed(1)} days) before its
              first excursion.
            </p>
          ) : null}
          <ControlChart series={unit.series} limits={unit.limits} spec={unit.spec} hits={unit.hits} />
          <div className="legend-row">
            <span className="lg band">control limits ±3 s (stable?)</span>
            <span className="lg spec">spec limits (capable?)</span>
            <span className="lg signal">run-rule signal</span>
            <span className="lg excursion">excursion (out of spec)</span>
          </div>
          <HowToRead>
            Blue band = control limits from this unit's own first {unit.baseline_n} readings (x̄ = {temp(unit.limits.xbar)}, ±3 s with s = mR̄/1.128 ={' '}
            {num(unit.limits.sigma_s, 3)} °C). Points outside the band or forming the 8 run-rule patterns are special-cause
            variation: the unit is <i>unstable</i>. Dashed red lines are the regulatory storage spec: crossing them is an
            <i> excursion</i> and the product must be evaluated.
          </HowToRead>
        </Section>

        <Section title="Moving range (MR) chart" kicker="Short-term variation">
          <MRChart series={unit.series} limits={unit.limits} />
          <HowToRead>
            Each point is the jump between consecutive readings. mR̄ = {num(unit.limits.mrbar, 3)} °C; the upper limit is D4·mR̄ = 3.267 × mR̄ ={' '}
            {num(unit.limits.mr_upper, 3)} °C. Big jumps mean a door left open, a power blip or a misread thermometer.
          </HowToRead>
        </Section>

        <div className="grid-2">
          <Section title="Run-rule signals" kicker="8 visual tests (Lesson 5)">
            {unit.hits.filter((h) => !unit.series.baseline[h.index]).length === 0 ? (
              <p className="empty">No special-cause patterns after the baseline.</p>
            ) : (
              <ul className="rules">
                {Object.entries(
                  unit.hits
                    .filter((h) => !unit.series.baseline[h.index])
                    .reduce((acc, h) => ({ ...acc, [h.rule]: [...(acc[h.rule] || []), h] }), {})
                ).map(([rule, hs]) => (
                  <li key={rule} className={recentRules.includes(+rule) ? 'recent' : ''}>
                    <b>Rule {rule}</b> {hs[0].description}
                    <small>
                      {hs.length} reading(s), first {when(hs[0].timestamp)}, last {when(hs[hs.length - 1].timestamp)}
                    </small>
                  </li>
                ))}
              </ul>
            )}
            <p className="muted small">
              The status changes only on a <b>confirmed</b> signal: at least 3 signalling readings in 24 h. That cuts false alarms on
              healthy units from about 48% to 1% a week (see Methods).
            </p>
          </Section>
          <Section title="Capability vs storage spec" kicker="Cp · Cpk · Pp · Ppk">
            <Capability cap={unit.capability} recentPpk={unit.recent_ppk} spec={unit.spec} />
          </Section>
        </div>
      </div>
    </div>
  )
}
