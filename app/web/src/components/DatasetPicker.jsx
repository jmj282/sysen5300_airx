// Big, obvious dataset chooser: what each test dataset is, what was planted in it, and downloads.
import { API_URL } from '../api.js'

export const DATASET_THEME = {
  normal_operation: { icon: '✓', accent: '#2ec27e', accent2: '#4cc9f0', label: 'Healthy' },
  temperature_degradation: { icon: '🌡', accent: '#ff8c42', accent2: '#ffd166', label: 'Fridge failing' },
  generator_failure: { icon: '⚡', accent: '#ff4d5e', accent2: '#b388ff', label: 'Generator failing' },
  upload: { icon: '⬆', accent: '#4cc9f0', accent2: '#b388ff', label: 'Your data' },
}

const kb = (b) => `${(b / 1024).toFixed(b < 10240 ? 1 : 0)} KB`

export default function DatasetPicker({ datasets, active, onPick, uploadName, busy }) {
  return (
    <section className="datasets" aria-label="Choose a test dataset">
      <div className="datasets-head" data-fx>
        <div>
          <div className="kicker">Test datasets · synthetic, seed 5300</div>
          <h2>Pick the blood bank you want to inspect</h2>
        </div>
        <p className="muted small">
          Each dataset is the same 12 storage units and 2 generators with one planted problem, so you can check the tool finds it.{' '}
          <a href="https://github.com/jmj282/sysen5300_airx/blob/main/data/README.md" target="_blank" rel="noreferrer">
            Full codebook ↗
          </a>
        </p>
      </div>
      <div className="dataset-grid">
        {datasets.map((d, i) => {
          const th = DATASET_THEME[d.id] || DATASET_THEME.upload
          const on = active === d.id
          return (
            <article
              key={d.id}
              data-fx
              className={`dataset ${on ? 'on' : ''}`}
              style={{ '--ds': th.accent, '--ds2': th.accent2, animationDelay: `${i * 90}ms` }}
            >
              <button className="dataset-main" onClick={() => onPick(d.id)} disabled={busy || on} aria-pressed={on}>
                <span className="dataset-icon">{th.icon}</span>
                <span className="dataset-text">
                  <span className="dataset-title">
                    {d.title}
                    {on ? <span className="viewing">● Viewing</span> : <span className="tag">{th.label}</span>}
                  </span>
                  <span className="dataset-tagline">{d.tagline}</span>
                </span>
              </button>
              <p className="dataset-planted">
                <b>Planted:</b> {d.planted}
              </p>
              <p className="dataset-expect">
                <b>Expect:</b> {d.expect}
              </p>
              <div className="dataset-files">
                <a className="dl-all" href={`${API_URL}/datasets/${d.id}.zip`} download>
                  ⤓ Download all (zip)
                </a>
                {d.files.map((f) => (
                  <a key={f.name} className="dl-file" href={`${API_URL}/datasets/${d.id}/${f.name}`} download title={`${f.rows.toLocaleString()} rows · ${kb(f.bytes)}`}>
                    {f.name}
                    <small>{f.rows.toLocaleString()} rows</small>
                  </a>
                ))}
              </div>
            </article>
          )
        })}
        {uploadName ? (
          <article data-fx className={`dataset ${active === 'upload' ? 'on' : ''}`} style={{ '--ds': DATASET_THEME.upload.accent, '--ds2': DATASET_THEME.upload.accent2 }}>
            <button className="dataset-main" onClick={() => onPick('upload')} disabled={busy || active === 'upload'} aria-pressed={active === 'upload'}>
              <span className="dataset-icon">{DATASET_THEME.upload.icon}</span>
              <span className="dataset-text">
                <span className="dataset-title">
                  Your upload {active === 'upload' ? <span className="viewing">● Viewing</span> : null}
                </span>
                <span className="dataset-tagline">{uploadName}</span>
              </span>
            </button>
          </article>
        ) : null}
      </div>
    </section>
  )
}

/** Compact "you are looking at" banner shown on every page. */
export function ViewingBanner({ dataset, uploadName, onChange }) {
  const id = dataset?.id || 'upload'
  const th = DATASET_THEME[id] || DATASET_THEME.upload
  return (
    <button className="viewing-banner" style={{ '--ds': th.accent, '--ds2': th.accent2 }} onClick={onChange} title="Change dataset">
      <span className="pulse" />
      <span className="vb-label">Viewing</span>
      <b>{dataset ? dataset.title : `Your upload (${uploadName})`}</b>
      <span className="vb-change">change ↓</span>
    </button>
  )
}
