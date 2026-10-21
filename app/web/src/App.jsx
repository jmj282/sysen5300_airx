import { useEffect, useState } from 'react'
import { API_URL, analyzeScenario, listDatasets } from './api.js'
import Generators from './pages/Generators.jsx'
import Methods from './pages/Methods.jsx'
import Overview from './pages/Overview.jsx'
import Temperature from './pages/Temperature.jsx'
import Upload from './pages/Upload.jsx'

const PAGES = [
  ['overview', 'Overview'],
  ['temperature', 'Temperature'],
  ['generators', 'Generators'],
  ['upload', 'Upload data'],
  ['methods', 'Methods'],
]

export default function App() {
  const [page, setPage] = useState('overview')
  const [datasets, setDatasets] = useState([])
  const [source, setSource] = useState('temperature_degradation')
  const [report, setReport] = useState(null)
  const [uploadName, setUploadName] = useState(null)
  const [error, setError] = useState(null)
  const [unit, setUnit] = useState(null)
  const [gen, setGen] = useState(null)

  useEffect(() => {
    listDatasets().then(setDatasets).catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (source === 'upload') return
    setError(null)
    analyzeScenario(source)
      .then((r) => {
        setReport(r)
        setUnit(firstAlert(r.units, 'unit_id'))
        setGen(firstAlert(r.generators, 'generator_id'))
      })
      .catch((e) => setError(e.message))
  }, [source])

  const go = (p, id) => {
    if (p === 'temperature') setUnit(id)
    if (p === 'generators') setGen(id)
    setPage(p)
  }

  const onUpload = (r, name) => {
    setReport(r)
    setUploadName(name)
    setSource('upload')
    setUnit(firstAlert(r.units, 'unit_id'))
    setGen(firstAlert(r.generators, 'generator_id'))
    setPage('overview')
  }

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="logo">🩸</span>
          <div>
            <h1>
              AirX <span>ColdChain QC</span>
            </h1>
            <small>Six Sigma monitoring for blood bank refrigeration and backup power</small>
          </div>
        </div>
        <label className="picker">
          <span>Data</span>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.description}
              </option>
            ))}
            {uploadName ? <option value="upload">Uploaded: {uploadName}</option> : null}
          </select>
        </label>
      </header>

      <nav className="tabs">
        {PAGES.map(([k, label]) => (
          <button key={k} className={page === k ? 'on' : ''} onClick={() => setPage(k)}>
            {label}
          </button>
        ))}
      </nav>

      <main>
        {error ? (
          <div className="card error-card">
            <h2>Can’t reach the analysis API</h2>
            <p>{error}</p>
            <p className="muted">
              The dashboard expects the API at <code>{API_URL}</code>. Start it with <code>app/api/testme.sh</code>, or set{' '}
              <code>VITE_API_URL</code>.
            </p>
          </div>
        ) : null}
        {page === 'upload' ? <Upload onReport={onUpload} /> : null}
        {page === 'methods' ? <Methods /> : null}
        {report && page === 'overview' ? <Overview report={report} go={go} /> : null}
        {report && page === 'temperature' ? <Temperature report={report} selected={unit} select={setUnit} /> : null}
        {report && page === 'generators' ? <Generators report={report} selected={gen} select={setGen} /> : null}
        {!report && !error && !['upload', 'methods'].includes(page) ? <p className="loading">Analyzing…</p> : null}
      </main>

      <footer>
        Team AirX · SYSEN 5300 Six Sigma Hackathon (DL Challenge, Blood Banks prompt) · statistics from the bloodbank_qc Python library ·{' '}
        <a href={`${API_URL}/docs`} target="_blank" rel="noreferrer">
          API docs
        </a>
      </footer>
    </div>
  )
}

function firstAlert(items, key) {
  const order = { Critical: 0, Warning: 1, Review: 2, Normal: 3 }
  const sorted = [...items].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9))
  return sorted[0]?.[key] ?? null
}
