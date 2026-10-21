#!/usr/bin/env bash
# Publish the API to Posit Connect. Needs CONNECT_SERVER and CONNECT_API_KEY in a gitignored .env
# at the repo root (never commit them). Run ./manifestme.sh first.
set -euo pipefail
cd "$(dirname "$0")"
set -a; source ../../.env; set +a
rsconnect deploy fastapi --server "$CONNECT_SERVER" --api-key "$CONNECT_API_KEY" \
  --entrypoint app:app --title "AirX ColdChain QC API" --exclude tests .
