# AirX ColdChain QC: dashboard

Vite + React, hand-drawn SVG charts, no UI kit or chart library. **No statistics live here.** Every
number is fetched from the API (`src/api.js` is the only file that knows the API address).

## Run

```bash
./testme.sh        # npm ci (first time), vitest, then http://localhost:5173
```

The API must be running (`../api/testme.sh`). To point at a deployed API, create `.env.local`:

```
VITE_API_URL=https://your-api-address
```

## Pages

| Page | Shows | Built from |
|---|---|---|
| Overview | tiles (units, alerts, excursions, generator failures, $ at risk), equipment status, ranked actions, DMAIC strip | `report.overview`, `units`, `generators`, `actions` |
| Temperature | unit list; I chart (control band, spec lines, baseline, signals, excursions); MR chart; run-rule list; capability table with CIs | `units[i]` |
| Generators | P(start), λ̂, MTTF, R(t), P(loss), $ at risk; block diagram; p chart; R(t) curve; latest log | `generators[i]` |
| Upload data | three CSV inputs, sample downloads, upload history (this browser's localStorage) | `POST /analyze` |
| Methods | the Six Sigma method behind each number, with textbook links and assumptions | static |

## Files

```
src/api.js              API calls (only place with the API URL)
src/format.js           display formatting (tested in format.test.js)
src/components/Charts.jsx   ControlChart, MRChart, PChart, ReliabilityChart, BlockDiagram (SVG)
src/components/Common.jsx   Pill, StatusRow, Tile, HowToRead, Section
src/pages/*.jsx         one file per page
src/styles.css          dark theme
```

## Build and deploy

```bash
./manifestme.sh    # npm run build + rsconnect write-manifest html dist  (set VITE_API_URL first)
./deployme.sh      # rsconnect deploy html (needs ../../.env)
```

`vite.config.js` sets `base: './'` so `dist/` works under any URL path, including a Posit Connect content path.
