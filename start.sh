#!/usr/bin/env bash
# AirX ColdChain QC: run the whole app on your own computer with one command.
#   ./start.sh          (macOS / Linux / Git Bash on Windows)
# First run installs everything (about 1-2 minutes). Press Ctrl+C to stop.
set -euo pipefail
cd "$(dirname "$0")"

# Find a Python that actually runs and is 3.10+. (On Windows, "python3" can be a Microsoft Store
# placeholder that doesn't run, so each candidate is tested rather than trusted.)
PY=""
for c in python3 python py; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' >/dev/null 2>&1; then
    PY="$c"
    break
  fi
done
[ -n "$PY" ] || { echo "Python 3.10+ is required. Install it (see README, Step 1), then open a new terminal."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "Node.js 20+ is required. Install it (see README, Step 1), then open a new terminal."; exit 1; }
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
[ "$NODE_MAJOR" -ge 20 ] || { echo "Node.js 20+ is required (found $(node --version 2>/dev/null)). Install the LTS from https://nodejs.org/"; exit 1; }

if [ ! -d .venv ]; then
  echo "▶ Creating Python environment (.venv)..."
  "$PY" -m venv .venv
fi
VPY=.venv/bin/python
[ -x "$VPY" ] || VPY=.venv/Scripts/python.exe   # Windows
echo "▶ Installing Python packages..."
"$VPY" -m pip install -q --disable-pip-version-check -r app/api/requirements.txt

if [ ! -d app/web/node_modules ]; then
  echo "▶ Installing dashboard packages..."
  (cd app/web && npm ci --no-audit --no-fund --silent)
fi

echo "▶ Starting the analysis API on http://localhost:8000 ..."
"$VPY" -m uvicorn app:app --app-dir app/api --port 8000 --log-level warning &
API_PID=$!
trap 'kill $API_PID 2>/dev/null' EXIT INT TERM
for _ in $(seq 1 40); do
  curl -s http://localhost:8000/ >/dev/null 2>&1 && break
  sleep 0.5
done

echo "▶ Starting the dashboard on http://localhost:5173  (Ctrl+C to stop)"
OPEN_FLAG="--open"
[ "${NO_OPEN:-}" = "1" ] && OPEN_FLAG=""
cd app/web && npx vite --port 5173 --strictPort $OPEN_FLAG
