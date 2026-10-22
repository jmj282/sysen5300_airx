// Dataset Explorer: browse any bundled test file without downloading it. What each column means,
// a plain descriptive summary of each column, and the rows themselves (filterable, paged).
// Everything shown comes from GET /datasets/{id}/explore.
import { useEffect, useState } from 'react'
import { datasetFileUrl, exploreDataset } from '../api.js'
import { DATASET_THEME } from './DatasetPicker.jsx'

const FILES = [
  ['units.csv', '🧊 Units', 'the inventory list'],
  ['temperature_log.csv', '🌡 Temperature log', 'every 4-hour reading'],
  ['generator_log.csv', '⚡ Generator log', 'every start demand'],
]
const PAGE = 25

const fmtNum = (v) => (v === null || v === undefined ? '—' : Number.isInteger(v) ? v.toLocaleString() : Number(v).toFixed(2))

export default function DatasetExplorer({ datasets, active }) {
  const [ds, setDs] = useState(active && active !== 'upload' ? active : datasets[0]?.id)
  const [file, setFile] = useState('temperature_log.csv')
  const [filterId, setFilterId] = useState('')
  const [offset, setOffset] = useState(0)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  // Follow the dataset being viewed at the top of the page.
  useEffect(() => {
    if (active && active !== 'upload') setDs(active)
  }, [active])
  useEffect(() => {
    setOffset(0)
    setFilterId('')
  }, [ds, file])
  useEffect(() => {
    if (!ds) return
    let live = true
    setLoading(true)
    exploreDataset(ds, file, { offset, limit: PAGE, filterId })
      .then((d) => live && (setData(d), setError(null)))
      .catch((e) => live && setError(e.message))
      .finally(() => live && setLoading(false))
    return () => {
      live = false
    }
  }, [ds, file, offset, filterId])

  const th = DATASET_THEME[ds] || DATASET_THEME.upload
  const meta = datasets.find((d) => d.id === ds)
  const pages = data ? Math.max(1, Math.ceil(data.total_rows / PAGE)) : 1
  const page = Math.floor(offset / PAGE) + 1

  return (
    <section className="card explorer" data-fx style={{ '--ds': th.accent, '--ds2': th.accent2 }}>
      <header className="card-head">
        <div>
          <div className="kicker">Dataset explorer · look inside before you download</div>
          <h2>What’s in each file?</h2>
        </div>
        <div className="ex-ds">
          {datasets.map((d) => {
            const t = DATASET_THEME[d.id]
            return (
              <button key={d.id} className={`ex-chip ${d.id === ds ? 'on' : ''}`} style={{ '--ds': t.accent }} onClick={() => setDs(d.id)}>
                {t.icon} {d.title}
              </button>
            )
          })}
        </div>
      </header>

      <div className="ex-files" role="tablist">
        {FILES.map(([f, label, sub]) => {
          const info = meta?.files.find((x) => x.name === f)
          return (
            <button key={f} role="tab" aria-selected={f === file} className={`ex-file ${f === file ? 'on' : ''}`} onClick={() => setFile(f)}>
              <b>{label}</b>
              <small>
                {f} · {sub}
                {info ? ` · ${info.rows.toLocaleString()} rows` : ''}
              </small>
            </button>
          )
        })}
      </div>

      {error ? <p className="error">⚠ {error}</p> : null}
      {data ? (
        <div className={`ex-body ${loading ? 'loading-dim' : ''}`}>
          <p className="ex-about">
            {data.about}{' '}
            <a href={datasetFileUrl(ds, file)} download>
              ⤓ Download {file}
            </a>
          </p>

          <h3 className="ex-h">Columns: what they mean and how they're collected</h3>
          <div className="ex-cols">
            {data.columns.map((c, i) => (
              <div key={c.name} className="ex-col" style={{ '--i': i }}>
                <div className="ex-col-head">
                  <code>{c.name}</code>
                  <span className="ex-type">
                    {c.type}
                    {c.unit ? ` · ${c.unit}` : ''}
                  </span>
                </div>
                <p>{c.meaning}</p>
                <small className="muted">Source: {c.source}</small>
                <div className="ex-sum">
                  {'mean' in c.summary ? (
                    <>
                      <span>
                        min <b>{fmtNum(c.summary.min)}</b>
                      </span>
                      <span>
                        mean <b>{fmtNum(c.summary.mean)}</b>
                      </span>
                      <span>
                        max <b>{fmtNum(c.summary.max)}</b>
                      </span>
                    </>
                  ) : c.summary.first ? (
                    <>
                      <span>
                        from <b>{c.summary.first.slice(0, 16)}</b>
                      </span>
                      <span>
                        to <b>{c.summary.last.slice(0, 16)}</b>
                      </span>
                    </>
                  ) : (
                    <>
                      <span>
                        <b>{c.summary.distinct}</b> distinct
                      </span>
                      {c.summary.top.slice(0, 3).map(([k, n]) => (
                        <span key={k}>
                          {k} <b>×{n}</b>
                        </span>
                      ))}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="ex-table-head">
            <h3 className="ex-h">
              Rows {data.total_rows ? `${(offset + 1).toLocaleString()}–${Math.min(offset + PAGE, data.total_rows).toLocaleString()}` : '0'} of{' '}
              {data.total_rows.toLocaleString()}
            </h3>
            {data.id_column ? (
              <label className="ex-filter">
                Show only
                <select value={filterId} onChange={(e) => (setOffset(0), setFilterId(e.target.value))}>
                  <option value="">all {data.id_column === 'unit_id' ? 'units' : 'generators'}</option>
                  {data.ids.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="ex-pager">
              <button onClick={() => setOffset(0)} disabled={page <= 1}>
                ⏮
              </button>
              <button onClick={() => setOffset(Math.max(0, offset - PAGE))} disabled={page <= 1}>
                ◀ Prev
              </button>
              <span>
                page {page} / {pages}
              </span>
              <button onClick={() => setOffset(offset + PAGE)} disabled={page >= pages}>
                Next ▶
              </button>
              <button onClick={() => setOffset((pages - 1) * PAGE)} disabled={page >= pages}>
                ⏭
              </button>
            </div>
          </div>
          <div className="ex-table-wrap">
            <table className="ex-table">
              <thead>
                <tr>
                  <th>#</th>
                  {data.columns.map((c) => (
                    <th key={c.name}>{c.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <tr key={offset + i}>
                    <td className="muted">{offset + i + 1}</td>
                    {r.map((v, j) => (
                      <td key={j} className={cellClass(data.columns[j].name, v)}>
                        {v === null ? '—' : String(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <p className="loading">Loading…</p>
      )}
    </section>
  )
}

// Highlight values that matter when scanning raw logs (display only).
function cellClass(col, v) {
  if ((col === 'started' && v === 0) || (col === 'run_failure' && v === 1)) return 'cell-bad'
  if (col === 'test_type' && v === 'outage') return 'cell-warn'
  return ''
}
