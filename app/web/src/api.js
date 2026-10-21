// The ONLY place the API base URL lives. For a deployed API, set VITE_API_URL in app/web/.env.local
// (or in the build environment) and rebuild.
export const API_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

async function getJson(path, options) {
  const res = await fetch(`${API_URL}${path}`, options)
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = await res.json()
      if (body.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      /* not JSON */
    }
    throw new Error(detail)
  }
  return res.json()
}

/** GET / : health check. */
export const checkApi = () => getJson('/')

/** GET /datasets : the three bundled test scenarios. */
export const listDatasets = () => getJson('/datasets')

/** GET /analyze/{scenario} : the full report for a bundled scenario. */
export const analyzeScenario = (id, params = {}) => {
  const q = new URLSearchParams(params).toString()
  return getJson(`/analyze/${id}${q ? `?${q}` : ''}`)
}

/** POST /analyze : the full report for three uploaded CSV files. */
export const analyzeUpload = (files, params = {}) => {
  const form = new FormData()
  form.append('units', files.units)
  form.append('temperature_log', files.temperature_log)
  form.append('generator_log', files.generator_log)
  const q = new URLSearchParams(params).toString()
  return getJson(`/analyze${q ? `?${q}` : ''}`, { method: 'POST', body: form })
}

/** Link to download one bundled CSV, so users can copy the format. */
export const datasetFileUrl = (id, file) => `${API_URL}/datasets/${id}/${file}`
