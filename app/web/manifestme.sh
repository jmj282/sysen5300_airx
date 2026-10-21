#!/usr/bin/env bash
# Build the static dashboard and write manifest.json for Posit Connect.
# Set VITE_API_URL (in .env.local or the shell) to the DEPLOYED API address before building.
set -euo pipefail
cd "$(dirname "$0")"
[ -d node_modules ] || npm ci
npm run build
rsconnect write-manifest html --overwrite dist
