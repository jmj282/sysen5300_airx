// Big, obvious dataset chooser: what each test dataset is, what was planted in it, and downloads.
import { API_URL } from '../api.js'

export const DATASET_THEME = {
  normal_operation: { icon: '✓', accent: '#2ec27e', accent2: '#4cc9f0', label: 'Healthy' },
  temperature_degradation: { icon: '🌡', accent: '#ff8c42', accent2: '#ffd166', label: 'Fridge failing' },
  generator_failure: { icon: '⚡', accent: '#ff4d5e', accent2: '#b388ff', label: 'Generator failing' },
  upload: { icon: '⬆', accent: '#4cc9f0', accent2: '#b388ff', label: 'Your data' },
}

const kb = (b) => `${(b / 1024).toFixed(b < 10240 ? 1 : 0)} KB`

export default function DatasetPicker({ datasets, active, queued, onPick, uploadName, busy }) {
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
              <button className="dataset-main" onClick={() => onPick(d.id)} disabled={on && !busy} aria-pressed={on}>
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
              <div className="dataset-switch-row">
                {on ? (
                  <span className="switch-btn current">✓ Currently viewing</span>
                ) : queued === d.id ? (
                  <span className="switch-btn queued">⏳ Up next…</span>
                ) : (
                  <button className="switch-btn" onClick={() => onPick(d.id)}>
                    Switch to this dataset <span aria-hidden="true">→</span>
                  </button>
                )}
              </div>
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
            <button className="dataset-main" onClick={() => onPick('upload')} disabled={active === 'upload' && !busy} aria-pressed={active === 'upload'}>
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

const SHORT = { normal_operation: 'Normal', temperature_degradation: 'Fridge failing', generator_failure: 'Generator failing' }

/** Always-visible dataset switch in the header: one clear button per dataset. */
export function DatasetSwitch({ datasets, active, queued, onPick, busy, uploadName }) {
  const options = [...datasets.map((d) => ({ id: d.id, title: SHORT[d.id] || d.title })), ...(uploadName ? [{ id: 'upload', title: 'Your upload' }] : [])]
  return (
    <div className="ds-switch" role="radiogroup" aria-label="Switch dataset">
      <span className="ds-switch-label">Dataset</span>
      {options.map((o) => {
        const th = DATASET_THEME[o.id] || DATASET_THEME.upload
        const on = o.id === active
        return (
          <button
            key={o.id}
            role="radio"
            aria-checked={on}
            className={`ds-opt ${on ? 'on' : ''} ${queued === o.id ? 'queued' : ''} ${busy && on ? 'leaving' : ''}`}
            style={{ '--ds': th.accent, '--ds2': th.accent2 }}
            onClick={() => onPick(o.id)}
            title={on ? 'Currently viewing' : queued === o.id ? 'Up next' : `Switch to ${o.title}`}
          >
            <span className="ds-opt-icon">{on ? <span className="pulse" /> : th.icon}</span>
            {o.title}
          </button>
        )
      })}
    </div>
  )
}
