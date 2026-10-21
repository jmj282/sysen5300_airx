import { useState } from 'react'
import { analyzeUpload, datasetFileUrl } from '../api.js'
import { Section } from '../components/Common.jsx'

const FILES = [
  ['units', 'units.csv', 'One row per storage unit: unit_id, unit_type (RBC / PLASMA / PLATELETS), backup_generator, units_stored, value_per_unit'],
  ['temperature_log', 'temperature_log.csv', 'One row per thermometer reading: timestamp, unit_id, temp_c (every 4 hours)'],
  ['generator_log', 'generator_log.csv', 'One row per start demand: test_date, generator_id, test_type, started (1/0), run_hours, run_failure (1/0)'],
]
const HISTORY_KEY = 'airx-upload-history'

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
  } catch {
    return []
  }
}

export default function Upload({ onReport }) {
  const [files, setFiles] = useState({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState(loadHistory)
  const ready = FILES.every(([k]) => files[k])

  async function run() {
    setBusy(true)
    setError(null)
    const entry = { at: new Date().toISOString(), files: FILES.map(([k]) => files[k].name).join(', ') }
    try {
      const report = await analyzeUpload(files)
      entry.analyzed = true
      entry.alerts = report.overview.active_alerts
      onReport(report, entry.files)
    } catch (e) {
      entry.analyzed = false
      entry.error = e.message
      setError(e.message)
    } finally {
      const h = [entry, ...history].slice(0, 20)
      setHistory(h)
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(h))
      } catch {
        /* storage blocked: history just won't persist */
      }
      setBusy(false)
    }
  }

  return (
    <div className="grid-2">
      <Section title="Upload your logs" kicker="Measure">
        <p>
          Three plain CSV files that a blood bank already keeps on paper. No sensors, no account. The analysis is the same statistics as the
          bundled scenarios: control limits, run rules, capability and reliability, with rule-based alerts.
        </p>
        {FILES.map(([k, name, desc]) => (
          <label key={k} className="file">
            <b>{name}</b>
            <small>{desc}</small>
            <input type="file" accept=".csv,text/csv" onChange={(e) => setFiles({ ...files, [k]: e.target.files[0] })} />
          </label>
        ))}
        <button className="primary" disabled={!ready || busy} onClick={run}>
          {busy ? 'Analyzing…' : 'Analyze'}
        </button>
        {error ? <p className="error">⚠ {error}</p> : null}
        <p className="muted small">
          Need the format? Download a sample:{' '}
          {FILES.map(([, name]) => (
            <a key={name} href={datasetFileUrl('temperature_degradation', name)}>
              {name}{' '}
            </a>
          ))}
        </p>
      </Section>

      <Section title="Upload history" kicker="This browser only">
        {history.length === 0 ? (
          <p className="empty">No uploads yet.</p>
        ) : (
          <table className="log">
            <thead>
              <tr>
                <th>When</th>
                <th>Files</th>
                <th>Analyzed</th>
                <th>Alerts</th>
              </tr>
            </thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={i} className={h.analyzed ? '' : 'bad-row'}>
                  <td>{new Date(h.at).toLocaleString()}</td>
                  <td>{h.files}</td>
                  <td>{h.analyzed ? '✓' : `✗ ${h.error || ''}`}</td>
                  <td>{h.analyzed ? h.alerts : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </div>
  )
}
