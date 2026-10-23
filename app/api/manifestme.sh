#!/usr/bin/env bash
# Write manifest.json for Posit Connect (run on your own machine after any dependency change).
# Copies the three test scenarios into ./data so the deployed bundle can serve them.
set -euo pipefail
cd "$(dirname "$0")"
rm -rf data && mkdir data && cp -R ../../data/normal_operation ../../data/temperature_degradation ../../data/generator_failure ../../data/README.md data/
# Build the dashboard to call the API at its own address ('.') and bundle it as ./static, served at /.
(cd ../web && { [ -d node_modules ] || npm ci; } && VITE_API_URL=. npm run build)
rm -rf static && cp -R ../web/dist static
# Only files git commits may be listed: GitHub Actions uploads exactly this list from a fresh checkout.
# So drop Python/pytest caches (recreated on the next run) and leave out the local deploy record.
find . -name __pycache__ -type d -prune -exec rm -rf {} + && rm -rf .pytest_cache
rsconnect write-manifest fastapi --overwrite --entrypoint app:app --exclude tests --exclude rsconnect-python .
