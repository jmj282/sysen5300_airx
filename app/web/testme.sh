#!/usr/bin/env bash
# Run the AirX ColdChain QC dashboard locally (needs Node 20+). Start the API first: app/api/testme.sh
set -euo pipefail
cd "$(dirname "$0")"
[ -d node_modules ] || npm ci
npm test
echo "Dashboard: http://localhost:5173  (expects the API at http://127.0.0.1:8000 unless VITE_API_URL is set)"
exec npm run dev -- --port 5173
