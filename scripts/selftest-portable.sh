#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../dist/Vaultbook-Portable"
ROOT="$PWD"
DATA="$(mktemp -d)"

DEPLOY_MODE=portable HOSTNAME=127.0.0.1 PORT=4783 \
DATA_DIR="$DATA" MIGRATIONS_DIR="$ROOT/app/migrations" \
LAUNCHER_TOKEN=selftest ./node/bin/node app/server.js &
PID=$!
trap 'kill $PID 2>/dev/null || true; rm -rf "$DATA"' EXIT

# wait for the server instead of racing it
curl --retry 30 --retry-delay 1 --retry-connrefused -sf \
  http://127.0.0.1:4783/api/heartbeat >/dev/null
curl -sf -H 'x-launcher-token: selftest' \
  http://127.0.0.1:4783/api/internal/selftest
echo