import { Section } from '../components/Common.jsx'

const TEAM = ['Owyn Adams', 'Jake Janish', 'Roman Nagirniak', 'Nkenna Opara', 'Carter Perun']
const initials = (n) =>
  n
    .split(' ')
    .map((p) => p[0])
    .join('')

const HOW = [
  ['1', 'Pick a dataset', 'Use the Dataset buttons at the top, or a card on the Overview. Each test dataset has one planted problem.'],
  ['2', 'Read the Overview', 'The light board and status list show every unit and generator. "What to do first" ranks the actions.'],
  ['3', 'Open a unit', 'Temperature shows its control chart, run-rule signals and capability. Generators shows start reliability and blackout risk.'],
  ['4', 'Check the method', 'Methods explains every number in plain language. Each chart has a "How to read this" note.'],
  ['5', 'Use your own logs', 'Upload data takes three CSV files in the same format as the downloads.'],
]

export default function About() {
  return (
    <div className="stack about">
      <Section title="About AirX" kicker="The team behind ColdChain QC">
        <div className="about-hero">
          <div className="about-mark">
            <span>🩸</span>
          </div>
          <div>
            <p className="about-lede">
              <b>AirX</b> is a five-person team in Cornell’s <b>SYSEN 5300: Systems Engineering and Six Sigma</b> (Fall 2026). We built{' '}
              <b>AirX ColdChain QC</b> for the Six Sigma Hackathon’s Virtual DL Challenge, prompt <i>Health Care Systems: Blood Banks</i>.
            </p>
            <blockquote>
              “A regional blood bank loses thousands of dollars of supply when older refrigeration units fail or backup generators don’t start
              during blackouts. Design a tool to track blood bank supply integrity and flag/predict failures.”
            </blockquote>
          </div>
        </div>
        <div className="team">
          {TEAM.map((n, i) => (
            <div key={n} className="member" style={{ '--i': i }}>
              <span className="avatar">{initials(n)}</span>
              <b>{n}</b>
              <small>Team AirX</small>
            </div>
          ))}
        </div>
      </Section>

      <div className="grid-2">
        <Section title="What it does" kicker="Mission">
          <p>
            Blood banks already write down a fridge temperature every 4 hours and sign a generator logbook. ColdChain QC turns those paper logs
            into a shift-change answer: <b>which unit needs service or an inventory move before the blood is compromised</b>, and{' '}
            <b>will backup power last through the next blackout?</b>
          </p>
          <p>
            Fridges get individuals (I-MR) control charts with the 8 run rules and capability indices against the storage spec. Generators get
            a p chart of failed starts, exponential reliability and a block diagram of grid plus backup power, which gives the chance of losing
            cooling and the dollars of blood at risk.
          </p>
        </Section>
        <Section title="How to use it" kicker="Quick start">
          <ol className="howto">
            {HOW.map(([n, t, d]) => (
              <li key={n}>
                <span>{n}</span>
                <div>
                  <b>{t}</b>
                  <small>{d}</small>
                </div>
              </li>
            ))}
          </ol>
        </Section>
      </div>

      <div className="grid-2">
        <Section title="How it’s built" kicker="Open and reproducible">
          <ul className="built">
            <li>
              <b>Python library</b> <code>bloodbank_qc</code>: every statistic, tested against known answers from the course
            </li>
            <li>
              <b>REST API</b> (FastAPI): serves the analysis; try it at <code>/docs</code>
            </li>
            <li>
              <b>Dashboard</b> (React + Vite): draws the API’s numbers; no statistics in the browser
            </li>
            <li>
              <b>Test data:</b> three synthetic scenarios with a codebook (seed 5300)
            </li>
          </ul>
          <p>
            Code, docs and test data:{' '}
            <a href="https://github.com/jmj282/sysen5300_airx" target="_blank" rel="noreferrer">
              github.com/jmj282/sysen5300_airx
            </a>
          </p>
        </Section>
        <Section title="Credits" kicker="Thanks">
          <ul className="built">
            <li>Methods follow the SYSEN 5300 course textbook and code by Dr. Timothy Fraser, Cornell University.</li>
            <li>Storage specifications: FDA 21 CFR 640 and AABB Standards.</li>
            <li>Built with AI coding assistance, which the hackathon allows and encourages; every statistic was checked against the course’s known answers.</li>
          </ul>
        </Section>
      </div>
    </div>
  )
}
