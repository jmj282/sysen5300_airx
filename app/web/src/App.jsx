import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { API_URL, analyzeScenario, listDatasets } from './api.js'
import Background from './components/Background.jsx'
import Crawl from './components/Crawl.jsx'
import Wind from './components/Wind.jsx'
import DatasetExplorer from './components/DatasetExplorer.jsx'
import DatasetPicker, { DATASET_THEME, DatasetSwitch } from './components/DatasetPicker.jsx'
import { cancelAll, dropIn, pieces, prefersReducedMotion, shatterOut } from './physics.js'
import Generators from './pages/Generators.jsx'
import About from './pages/About.jsx'
import Methods from './pages/Methods.jsx'
import Overview from './pages/Overview.jsx'
import Temperature from './pages/Temperature.jsx'
import Upload from './pages/Upload.jsx'

// The opening crawl is hidden for now. Set to true to bring it back (components/Crawl.jsx is unchanged).
const SHOW_CRAWL = false

const PAGES = [
  ['overview', 'Overview'],
  ['temperature', 'Temperature'],
  ['generators', 'Generators'],
  ['upload', 'Upload data'],
  ['methods', 'Methods'],
  ['about', 'About AirX'],
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
  const [queuedId, setQueuedId] = useState(null)
  const [explorerOpen, setExplorerOpen] = useState(false)
  const mainRef = useRef(null)
  const pickerRef = useRef(null)
  // Refs (not state) for everything the switch logic reads, so rapid clicks see current values at once.
  const lock = useRef(false) // a transition is running
  const queued = useRef(null) // the latest click made while locked (last click wins)
  const sourceRef = useRef('temperature_degradation')
  const uploadRef = useRef(null)
  const requestNo = useRef(0) // ignores out-of-order API responses
  const dropDone = useRef(null) // resolves when the drop-in animation finishes
  const pendingDrop = useRef(false)

  useEffect(() => {
    listDatasets().then(setDatasets).catch((e) => setError(e.message))
    load('temperature_degradation').then(apply).catch((e) => setError(e.message))
  }, [])

  const load = (id) => (id === 'upload' ? Promise.resolve(uploadRef.current) : analyzeScenario(id))

  function apply(r) {
    setReport(r)
    setUnit(firstAlert(r.units, 'unit_id'))
    setGen(firstAlert(r.generators, 'generator_id'))
  }

  /**
   * Ask to switch dataset. Safe to spam: only one transition runs at a time, and clicks made during a
   * transition are debounced into one: the LAST requested dataset runs when the current one finishes.
   */
  function switchTo(id, preloaded) {
    if (lock.current) {
      queued.current = { id, preloaded }
      setQueuedId(id === sourceRef.current ? null : id)
      return
    }
    if (id === sourceRef.current && !preloaded) return
    runSwitch(id, preloaded)
  }

  /** One full transition: old UI tumbles away (matter-js), data loads, new UI drops in on springs. */
  async function runSwitch(id, preloaded) {
    lock.current = true
    setBusy(true)
    setError(null)
    const myRequest = ++requestNo.current
    const main = mainRef.current
    cancelAll(main) // stop anything still moving from a previous transition
    const animate = !prefersReducedMotion() && main && pieces(main).length > 0
    try {
      const dataP = preloaded ? Promise.resolve(preloaded) : load(id)
      let fall = Promise.resolve()
      if (animate) {
        fall = shatterOut(main)
        main.classList.add('fx-hidden') // the clones are on screen in its place
      }
      const [r] = await Promise.all([dataP, new Promise((res) => setTimeout(res, animate ? 650 : 0))])
      if (myRequest !== requestNo.current) return // a newer request superseded this one
      sourceRef.current = id
      setSource(id)
      const dropped = new Promise((res) => {
        dropDone.current = res
      })
      pendingDrop.current = animate
      apply(r)
      if (animate) {
        // Safety net: if the drop-in never starts, reveal the page anyway.
        await Promise.race([Promise.all([fall, dropped]), new Promise((res) => setTimeout(res, 5000))])
      }
    } catch (e) {
      setError(e.message)
    } finally {
      main?.classList.remove('fx-hidden')
      pendingDrop.current = false
      lock.current = false
      setBusy(false)
      const next = queued.current
      queued.current = null
      setQueuedId(null)
      if (next && (next.id !== sourceRef.current || next.preloaded)) setTimeout(() => switchTo(next.id, next.preloaded), 120)
    }
  }

  // After the new report renders (before paint), launch the new cards from above.
  useLayoutEffect(() => {
    if (!mainRef.current) return
    if (!pendingDrop.current) {
      dropDone.current?.()
      return
    }
    pendingDrop.current = false
    const main = mainRef.current
    main.classList.remove('fx-hidden')
    dropIn(main).then(() => dropDone.current?.())
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
    uploadRef.current = r
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
        {datasets.length ? <DatasetSwitch datasets={datasets} active={source} queued={queuedId} onPick={(id) => switchTo(id)} busy={busy} uploadName={uploadName} /> : null}
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
            <DatasetPicker datasets={datasets} active={source} queued={queuedId} onPick={(id) => switchTo(id)} uploadName={uploadName} busy={busy} />
            <button className={`explorer-tab ${explorerOpen ? 'open' : ''}`} onClick={() => setExplorerOpen((o) => !o)} aria-expanded={explorerOpen}>
              <span>🔎 Explorer</span>
              <small>{explorerOpen ? 'Hide the dataset details' : 'Look inside the dataset files: columns, meanings, summaries and rows'}</small>
              <i aria-hidden="true">{explorerOpen ? '▲' : '▼'}</i>
            </button>
            {explorerOpen ? <DatasetExplorer datasets={datasets} active={source} /> : null}
          </div>
        ) : null}
        {page === 'upload' ? <Upload onReport={onUpload} /> : null}
        {page === 'methods' ? <Methods /> : null}
        {page === 'about' ? <About /> : null}
        {report && page === 'overview' ? <Overview report={report} go={go} /> : null}
        {report && page === 'temperature' ? <Temperature report={report} selected={unit} select={setUnit} /> : null}
        {report && page === 'generators' ? <Generators report={report} selected={gen} select={setGen} /> : null}
        {!report && !error && !['upload', 'methods', 'about'].includes(page) ? <div className="loading">Analyzing…</div> : null}
      </main>

      {SHOW_CRAWL ? <Crawl /> : null}

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
