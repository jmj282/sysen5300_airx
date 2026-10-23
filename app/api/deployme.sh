#!/usr/bin/env bash
# Publish the API to Posit Connect. Needs CONNECT_SERVER and CONNECT_API_KEY in a gitignored .env
# at the repo root (never commit them). Run ./manifestme.sh first.
# --app-id updates the team's existing app (same public URL), whoever runs it: the key's owner must be
# the app's owner or a collaborator on it in Connect. GitHub Actions uses the same id (CONTENT_GUID).
set -euo pipefail
cd "$(dirname "$0")"
set -a; source ../../.env; set +a
rsconnect deploy fastapi --server "$CONNECT_SERVER" --api-key "$CONNECT_API_KEY" \
  --app-id 2f99849a-2483-4b3e-91c5-1bf7caf8e417 \
  --entrypoint app:app --title "AirX ColdChain QC API" --exclude tests --exclude rsconnect-python .
