import { BlockDiagram, PChart, ReliabilityChart } from '../components/Charts.jsx'
import { HowToRead, Pill, Section, StatusRow, Tile } from '../components/Common.jsx'
import { num, pct, usd } from '../format.js'

export default function Generators({ report, selected, select }) {
  const g = report.generators.find((x) => x.generator_id === selected) || report.generators[0]
  const r = g.running
  const oh = report.overview.outage_hours
  return (
    <div className="grid-side">
      <Section title="Backup generators" kicker="Pick a generator">
        <div className="status-list compact">
          {report.generators.map((x) => (
            <StatusRow
              key={x.generator_id}
              id={x.generator_id}
              title={`${x.units_covered.length} units`}
              reason={x.reason}
              status={x.status}
              active={x.generator_id === g.generator_id}
              onClick={() => select(x.generator_id)}
            />
          ))}
        </div>
      </Section>

      <div className="stack">
        <Section title={`${g.generator_id}: will it carry a ${oh} h blackout?`} kicker={`Protects ${g.units_covered.join(', ')}`} right={<Pill status={g.status} />}>
          <p className="reason">{g.reason}</p>
          <div className="tiles small">
            <Tile label="P(starts on demand)" num={g.start.p_start} fmt={(v) => pct(v)} tone={g.start.p_start >= 0.99 ? 'ok' : g.start.p_start >= 0.97 ? 'warn' : 'bad'} note={`${g.demands - g.start_failures} of ${g.demands} starts · 95% low ${pct(g.start.p_start_lower)}`} />
            <Tile label="Failure rate z(t) = λ̂" value={r.lambda_hat === 0 ? '0 /h' : `${num(r.lambda_hat * 1000, 2)} per 1000 h`} note={`${r.failures} failures in ${num(r.run_hours, 1)} run-hours · 95% up ${num(r.lambda_upper * 1000, 2)}`} />
            <Tile label="MTTF (= MTBF, repaired)" value={r.mttf === null ? 'no failures yet' : `${num(r.mttf, 0)} h`} tone={r.mttf === null ? 'ok' : r.mttf < 200 ? 'bad' : 'ok'} note={`95% lower bound ${num(r.mttf_lower, 0)} h`} />
            <Tile label={`R(${oh} h) once running`} num={r.R_t} fmt={(v) => num(v, 3)} tone={r.R_t >= 0.95 ? 'ok' : r.R_t >= 0.9 ? 'warn' : 'bad'} note={`95% low ${num(r.R_t_lower, 3)}`} />
            <Tile label="P(loss of cooling)" num={g.p_loss} fmt={(v) => pct(v)} note="1 − p_start × R(t)" tone={g.p_loss > 0.05 ? 'bad' : 'ok'} />
            <Tile label="Expected $ at risk" num={g.dollars_at_risk} fmt={usd} note={`of ${usd(g.inventory_value)} protected`} tone={g.dollars_at_risk > 10000 ? 'bad' : 'ok'} />
          </div>
          <BlockDiagram key={g.generator_id} pStart={g.start.p_start} rRun={r.R_t} pBackup={g.p_backup} outageHours={oh} />
          <HowToRead>
            During a blackout the grid branch is down, so the blood stays cold only if the generator <i>starts</i> AND <i>keeps running</i>: a
            series system, p × R(t). Grid and generator together are a parallel system. Caveat: a storm that takes out the grid can also
            disable the generator (common cause), which makes these numbers optimistic.
          </HowToRead>
        </Section>

        <div className="grid-2">
          <Section title="p chart: failed starts per quarter" kicker="Attribute SPC">
            <PChart key={g.generator_id} pc={g.p_chart} />
            <HowToRead>
              Each point is the fraction of start demands (weekly tests, monthly load tests, real outages) that failed that quarter. p̄ ={' '}
              {pct(g.p_chart.pbar, 2)} comes from the baseline quarters before the shaded (judged) window, so a new problem can’t widen its own
              limits. Red = above its upper limit, a special cause (e.g. a dying battery). Quarters (about 16 demands) are the rational subgroup.
              {g.p_chart.small_n ? ' Failures are rare (n·p̄ < 5), so the usual p̄ ± 3√(p̄(1−p̄)/n) limits would flag a single failure; the limits here are exact binomial probability limits with the same 0.135% false-alarm tail as 3σ.' : ' Limits: p̄ ± 3√(p̄(1−p̄)/n).'}
            </HowToRead>
          </Section>
          <Section title="Reliability vs outage length" kicker="Exponential R(t) = e^(−λt)">
            <ReliabilityChart key={g.generator_id} curve={g.reliability_curve} outageHours={oh} />
            <HowToRead>
              R(t) is the chance the generator is still running t hours into an outage, assuming a constant failure rate (the flat bottom of
              the bathtub curve). The dashed line uses the 95% upper bound on λ: what we can promise with confidence given only{' '}
              {num(r.run_hours, 0)} run-hours of evidence.
            </HowToRead>
          </Section>
        </div>

        <Section title="Latest log entries" kicker="Measure">
          <table className="log">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Started?</th>
                <th>Hours run</th>
                <th>Failed while running?</th>
              </tr>
            </thead>
            <tbody>
              {[...g.tests].reverse().map((t, i) => (
                <tr key={i} className={!t.started || t.run_failure ? 'bad-row' : ''} style={{ '--i': i }}>
                  <td>{t.test_date}</td>
                  <td>{t.test_type.replace('_', ' ')}</td>
                  <td>{t.started ? 'yes' : '✗ no'}</td>
                  <td>{t.run_hours}</td>
                  <td>{t.run_failure ? '✗ yes' : 'no'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      </div>
    </div>
  )
}
