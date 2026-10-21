#!/usr/bin/env bash
# Publish the built dashboard (dist/) to Posit Connect as static content.
# Needs CONNECT_SERVER and CONNECT_API_KEY in the gitignored .env at the repo root. Run ./manifestme.sh first.
set -euo pipefail
cd "$(dirname "$0")"
set -a; source ../../.env; set +a
rsconnect deploy html --server "$CONNECT_SERVER" --api-key "$CONNECT_API_KEY" --title "AirX ColdChain QC" dist
