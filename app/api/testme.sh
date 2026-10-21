#!/usr/bin/env bash
# Run the AirX ColdChain QC API locally on port 8000 (one command, no arguments).
# First run creates a virtual environment in the repo root and installs pinned dependencies.
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$(cd ../.. && pwd)"
if [ ! -x "$ROOT/.venv/bin/python" ]; then
  python3 -m venv "$ROOT/.venv"
  "$ROOT/.venv/bin/pip" install -q -r requirements-dev.txt
fi
"$ROOT/.venv/bin/python" -m pytest -q
echo "API: http://localhost:8000   interactive docs: http://localhost:8000/docs"
exec "$ROOT/.venv/bin/python" -m uvicorn app:app --host 0.0.0.0 --port 8000
