import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { API_URL, analyzeScenario, listDatasets } from './api.js'
import Background from './components/Background.jsx'
import Crawl from './components/Crawl.jsx'
import Wind from './components/Wind.jsx'
import DatasetPicker, { DATASET_THEME, DatasetSwitch } from './components/DatasetPicker.jsx'
import { dropIn, pieces, prefersReducedMotion, shatterOut } from './physics.js'
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
  const [uploadReport, setUploadReport] = useState(null)
  const [uploadName, setUploadName] = useState(null)
  const [error, setError] = useState(null)
  const [unit, setUnit] = useState(null)
  const [gen, setGen] = useState(null)
  const [busy, setBusy] = useState(false)
  const mainRef = useRef(null)
  const pendingDrop = useRef(false)
  const pickerRef = useRef(null)

  useEffect(() => {
    listDatasets().then(setDatasets).catch((e) => setError(e.message))
    load('temperature_degradation').then(apply).catch((e) => setError(e.message))
  }, [])

  const load = (id) => (id === 'upload' ? Promise.resolve(uploadReport) : analyzeScenario(id))

  function apply(r) {
    setReport(r)
    setUnit(firstAlert(r.units, 'unit_id'))
    setGen(firstAlert(r.generators, 'generator_id'))
  }

  /** Switch dataset with the physics transition: old UI tumbles away, new UI drops in. */
  async function switchTo(id, preloaded) {
    if (busy || (id === source && !preloaded)) return
    setBusy(true)
    setError(null)
    const animate = !prefersReducedMotion() && mainRef.current && pieces(mainRef.current).length
    try {
      const dataP = preloaded ? Promise.resolve(preloaded) : load(id)
      let fall = Promise.resolve()
      if (animate) {
        fall = shatterOut(mainRef.current)
        mainRef.current.classList.add('fx-hidden') // the clones are now on screen in its place
      }
      const [r] = await Promise.all([dataP, new Promise((res) => setTimeout(res, animate ? 650 : 0))])
      pendingDrop.current = animate
      setSource(id)
      apply(r)
      await fall
    } catch (e) {
      mainRef.current?.classList.remove('fx-hidden')
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  // After the new report renders (before paint), launch the new cards from above.
  useLayoutEffect(() => {
    if (!pendingDrop.current || !mainRef.current) return
    pendingDrop.current = false
    const main = mainRef.current
    main.classList.remove('fx-hidden')
    dropIn(main)
  }, [report])

  // Page (tab) changes: cards rise in, staggered.
  useLayoutEffect(() => {
    if (!mainRef.current || prefersReducedMotion()) return
    pieces(mainRef.current).forEach((el, i) => {
      el.classList.remove('fx-rise')
      void el.offsetWidth
      el.style.animationDelay = `${Math.min(i, 12) * 70}ms`
      el.classList.add('fx-rise')
      el.addEventListener('animationend', () => el.classList.remove('fx-rise'), { once: true })
    })
  }, [page])

  const go = (p, id) => {
    if (p === 'temperature') setUnit(id)
    if (p === 'generators') setGen(id)
    setPage(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const onUpload = (r, name) => {
    setUploadReport(r)
    setUploadName(name)
    setPage('overview')
    switchTo('upload', r)
  }

  const theme = DATASET_THEME[source] || DATASET_THEME.upload

  return (
    <div className="app" style={{ '--accent': theme.accent, '--accent2': theme.accent2 }}>
      <Background accent={theme.accent} accent2={theme.accent2} />
      <header className="top">
        <div className="brand">
          <Wind />
          <span className="logo">🩸</span>
          <div>
            <h1>
              AirX <span>ColdChain QC</span>
            </h1>
            <small>Six Sigma monitoring for blood bank refrigeration and backup power</small>
          </div>
        </div>
        {datasets.length ? <DatasetSwitch datasets={datasets} active={source} onPick={(id) => switchTo(id)} busy={busy} uploadName={uploadName} /> : null}
      </header>

      <nav className="tabs">
        {PAGES.map(([k, label]) => (
          <button key={k} className={page === k ? 'on' : ''} onClick={() => go(k)}>
            {label}
          </button>
        ))}
      </nav>

      <main ref={mainRef}>
        {error ? (
          <div className="card error-card" data-fx>
            <h2>Can’t reach the analysis API</h2>
            <p>{error}</p>
            <p className="muted">
              The dashboard expects the API at <code>{API_URL}</code>. Start it with <code>app/api/testme.sh</code>, or set{' '}
              <code>VITE_API_URL</code>.
            </p>
          </div>
        ) : null}
        {page === 'overview' && datasets.length ? (
          <div ref={pickerRef}>
            <DatasetPicker datasets={datasets} active={source} onPick={(id) => switchTo(id)} uploadName={uploadName} busy={busy} />
          </div>
        ) : null}
        {page === 'upload' ? <Upload onReport={onUpload} /> : null}
        {page === 'methods' ? <Methods /> : null}
        {report && page === 'overview' ? <Overview report={report} go={go} /> : null}
        {report && page === 'temperature' ? <Temperature report={report} selected={unit} select={setUnit} /> : null}
        {report && page === 'generators' ? <Generators report={report} selected={gen} select={setGen} /> : null}
        {!report && !error && !['upload', 'methods'].includes(page) ? <div className="loading">Analyzing…</div> : null}
      </main>

      <Crawl />

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
