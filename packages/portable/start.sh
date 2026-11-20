#!/usr/bin/env bash
cd "$(dirname "$0")"
chmod +x node/bin/node 2>/dev/null || true
exec ./node/bin/node launcher/launcher.js