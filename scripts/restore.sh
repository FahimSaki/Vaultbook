#!/usr/bin/env bash
# Restore a backup made by scripts/backup.sh. REPLACES the current database and photos.
#   ./scripts/restore.sh backups/vaultbook-2026-11-28-023000.tar.enc [--yes]
# Env: ENV_FILE (.env.selfhost)  NO_APP=1 (do not stop/start the app container)
# On a brand-new server: copy .env.selfhost (same MASTER_KEY!), run `docker compose ... up -d db`, then this script.
set -euo pipefail
cd "$(dirname "$0")/.."

FILE="${1:?usage: scripts/restore.sh <backup.tar.enc> [--yes]}"
ENV_FILE="${ENV_FILE:-.env.selfhost}"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f docker-compose.selfhost.yml)

[ -f "$FILE" ] || { echo "$FILE not found" >&2; exit 1; }
[ -f "$ENV_FILE" ] || { echo "$ENV_FILE not found" >&2; exit 1; }
BACKUP_KEY="$(grep '^BACKUP_KEY=' "$ENV_FILE" | cut -d= -f2-)"
[ -n "$BACKUP_KEY" ] || { echo "BACKUP_KEY is missing from $ENV_FILE" >&2; exit 1; }
export BACKUP_KEY

if [ -f "$FILE.sha256" ]; then ( cd "$(dirname "$FILE")" && sha256sum -c "$(basename "$FILE").sha256" ); fi

if [ "${2:-}" != "--yes" ]; then
  read -r -p "This replaces the current database and photos. Type 'restore' to continue: " ans
  [ "$ans" = restore ] || { echo "Cancelled."; exit 1; }
fi

umask 077
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "Decrypting..."
openssl enc -d -aes-256-cbc -pbkdf2 -iter 600000 -pass env:BACKUP_KEY -in "$FILE" | tar -C "$WORK" -xf -
( cd "$WORK" && grep -E '^[0-9a-f]{64} ' MANIFEST | sha256sum -c - )
BLOBS="$(grep '^blobs=' "$WORK/MANIFEST" | cut -d= -f2)"

[ "${NO_APP:-0}" = 1 ] || "${COMPOSE[@]}" stop app || true
"${COMPOSE[@]}" up -d --wait db

PSQL=("${COMPOSE[@]}" exec -T db psql -U vb_owner -v ON_ERROR_STOP=1)
echo "Recreating the database..."
"${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS vaultbook WITH (FORCE)" -c "CREATE DATABASE vaultbook OWNER vb_owner"
echo "Loading the dump..."
"${PSQL[@]}" -d vaultbook -q < "$WORK/db.sql" > /dev/null

# cached stock must equal the sum of its movements, or something fired twice
BAD="$("${PSQL[@]}" -d vaultbook -tA -c "SELECT count(*) FROM products p WHERE p.stock_on_hand <> coalesce((SELECT sum(qty) FROM stock_movements m WHERE m.product_id = p.id), 0)")"
[ "$BAD" = 0 ] || { echo "ERROR: $BAD products have stock that does not match their movements" >&2; exit 1; }

if [ "$BLOBS" = 1 ]; then
  echo "Restoring photos..."
  "${COMPOSE[@]}" run --rm --no-deps -T --entrypoint sh app -c 'find /data -mindepth 1 -delete && tar -C /data -xf -' < "$WORK/blobs.tar"
fi

[ "${NO_APP:-0}" = 1 ] || "${COMPOSE[@]}" up -d app
echo "Restore complete."