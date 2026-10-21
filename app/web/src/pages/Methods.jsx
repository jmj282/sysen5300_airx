import { Section } from '../components/Common.jsx'

const BOOK = 'https://timothyfraser.com/sigma/chapters/'

const METHODS = [
  {
    k: 'I-MR control chart',
    q: 'Is each fridge STABLE?',
    f: 'mR = |xₜ − xₜ₋₁|,  σ_short = mR̄ / 1.128,  limits = x̄ ± 3σ_short (= x̄ ± 2.66 mR̄),  MR upper = 3.267 mR̄',
    why: 'One manual reading at a time (subgroup size 1). Limits come from a 14-day baseline, then stay fixed so a new problem can’t hide inside them.',
    link: 'statistical-process-control-in-python.html',
  },
  {
    k: '8 run rules',
    q: 'Is there special-cause variation?',
    f: 'Rule 5: six readings in a row steadily rising = the signature of a failing compressor',
    why: 'Catches drifts days before the spec is breached. Rules 1–5 trigger a Warning, 6–8 a Review of how readings are taken. A status changes only on a confirmed signal (≥3 readings in 24 h).',
    link: 'statistical-process-control-in-python.html',
  },
  {
    k: 'Cp, Cpk, Pp, Ppk',
    q: 'Is each fridge CAPABLE of holding the storage spec?',
    f: 'Cp = (E_upper − E_lower)/6σ_short,  Cpk = min(μ − E_lower, E_upper − μ)/3σ_short,  P-indices use σ_total',
    why: 'Spec limits come from regulation (red cells 1–6 °C, plasma ≤ −18 °C, platelets 20–24 °C), never from the data. 95% CIs: SE = est·√(1/2v) for Cp/Pp, SE = est·√(1/2v + 1/(9n·est²)) for Cpk/Ppk.',
    link: 'indices-and-confidence-intervals-for-statistical-process-control-in-python.html',
  },
  {
    k: 'p chart',
    q: 'Is a generator failing to START more often than usual?',
    f: 'p̄ = Σ failures / Σ demands,  limits = p̄ ± 3√(p̄(1−p̄)/nᵢ)',
    why: 'Each weekly test, monthly load test and real outage is a pass/fail demand: binomial counts, an attribute chart. One point per quarter (about 15 demands) so a single failure is not a false alarm; p̄ comes from the quarters before the last 90 days.',
    link: 'statistical-process-control-in-python.html',
  },
  {
    k: 'Exponential reliability',
    q: 'Once started, will it keep RUNNING?',
    f: 'λ̂ = r / T,  R(t) = e^(−λt),  F(t) = 1 − R(t),  z(t) = λ,  MTTF = 1/λ,  λ_upper = χ²(0.95, 2(r+1)) / 2T',
    why: 'Constant failure rate (flat bottom of the bathtub). With zero failures the upper bound −ln(0.05)/T still gives an honest number. MTBF for a repaired generator equals MTTF under this model.',
    link: 'useful-life-distributions-exponential-in-python.html',
  },
  {
    k: 'System reliability',
    q: 'Will the blood stay cold through a blackout?',
    f: 'backup = p_start × R(t) (series),  system = 1 − (1 − R_grid)(1 − R_backup) (parallel),  $ at risk = inventory × (1 − backup)',
    why: 'Turns reliability into the prompt’s “thousands of dollars of supply”. Caveat: common-cause failures (the same storm) break independence.',
    link: 'system-reliability-in-python.html',
  },
]

export default function Methods() {
  return (
    <div className="stack">
      <Section title="The Six Sigma behind every number" kicker="SYSEN 5300 · Dr. Timothy Fraser">
        <p>
          AirX ColdChain QC follows the DMAIC cycle. <b>Define</b>: blood must stay inside its storage range, and backup power must start
          when the grid fails. <b>Measure</b>: technicians already log fridge temperatures every 4 hours and every generator test.{' '}
          <b>Analyze</b>: the methods below. <b>Improve</b>: the ranked actions on the Overview. <b>Control</b>: fixed baseline limits,
          re-checked every shift.
        </p>
        <p className="callout">
          <b>Stable ≠ capable.</b> Control limits (blue band) come from the process and answer “is it behaving consistently?”. Spec limits
          (dashed red) come from regulation and answer “is the blood safe?”. A fridge can be stable but incapable, or capable but drifting.
        </p>
      </Section>
      <div className="methods">
        {METHODS.map((m) => (
          <Section key={m.k} title={m.k} kicker={m.q}>
            <code className="formula">{m.f}</code>
            <p>{m.why}</p>
            <a href={BOOK + m.link} target="_blank" rel="noreferrer">
              Textbook chapter ↗
            </a>
          </Section>
        ))}
      </div>
      <Section title="Assumptions we state openly" kicker="Explain every number">
        <ul>
          <li>Readings are independent. Manual readings 4 hours apart are close to this, but autocorrelation would raise false alarms.</li>
          <li>The baseline (first 14 days) reflects normal operation. If a unit was already failing, re-baseline after repair.</li>
          <li>Generator running failures follow a constant hazard (exponential). Ageing units wear out (Weibull, shape m &gt; 1), which this underestimates.</li>
          <li>Grid and generator fail independently. Severe storms violate this.</li>
          <li>Unit values (e.g. $215 per red cell unit) are editable inputs in units.csv, not fixed facts.</li>
          <li>The MR-chart limit uses the textbook D4 = 3.267 (slides, 9/24 lecture), not the 3.66 in the course helper function.</li>
        </ul>
      </Section>
    </div>
  )
}
