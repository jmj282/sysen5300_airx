#!/usr/bin/env bash
# Write manifest.json for Posit Connect (run on your own machine after any dependency change).
# Copies the three test scenarios into ./data so the deployed bundle can serve them.
set -euo pipefail
cd "$(dirname "$0")"
rm -rf data && mkdir data && cp -R ../../data/normal_operation ../../data/temperature_degradation ../../data/generator_failure ../../data/README.md data/
# Build the dashboard to call the API at its own address ('.') and bundle it as ./static, served at /.
(cd ../web && { [ -d node_modules ] || npm ci; } && VITE_API_URL=. npm run build)
rm -rf static && cp -R ../web/dist static
rsconnect write-manifest fastapi --overwrite --entrypoint app:app --exclude tests --exclude "__pycache__" .
