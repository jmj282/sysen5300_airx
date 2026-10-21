#!/usr/bin/env bash
# Write manifest.json for Posit Connect (run on your own machine after any dependency change).
# Copies the three test scenarios into ./data so the deployed bundle can serve them.
set -euo pipefail
cd "$(dirname "$0")"
rm -rf data && mkdir data && cp -R ../../data/normal_operation ../../data/temperature_degradation ../../data/generator_failure data/
rsconnect write-manifest fastapi --overwrite --entrypoint app:app --exclude tests --exclude "__pycache__" .
