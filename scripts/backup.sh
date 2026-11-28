#!/usr/bin/env bash
# Encrypted backup of the self-host stack: database dump + photo blobs, in one file.
#   ./scripts/backup.sh   ->  backups/vaultbook-YYYY-MM-DD-HHMMSS.tar.enc (+ .sha256)
# Env: ENV_FILE (.env.selfhost)  BACKUP_DIR (backups)  KEEP (14)  SKIP_BLOBS=1 (database only)
# Cron example (daily 02:30):  30 2 * * * cd /path/to/vaultbook && ./scripts/backup.sh >> backups/backup.log 2>&1
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="${ENV_FILE:-.env.selfhost}"
BACKUP_DIR="${BACKUP_DIR:-backups}"
KEEP="${KEEP:-14}"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f docker-compose.selfhost.yml)

[ -f "$ENV_FILE" ] || { echo "$ENV_FILE not found; run scripts/keygen.sh first" >&2; exit 1; }
BACKUP_KEY="$(grep '^BACKUP_KEY=' "$ENV_FILE" | cut -d= -f2-)"
[ -n "$BACKUP_KEY" ] || { echo "BACKUP_KEY is missing from $ENV_FILE" >&2; exit 1; }
export BACKUP_KEY

umask 077
mkdir -p "$BACKUP_DIR"
WORK="$(mktemp -d "$BACKUP_DIR/.tmp.XXXXXX")"
trap 'rm -rf "$WORK"' EXIT

STAMP="$(date +%F-%H%M%S)"
OUT="$BACKUP_DIR/vaultbook-$STAMP.tar.enc"

echo "Dumping database..."
# --disable-triggers: on restore, the stock and price-history triggers must not fire again
"${COMPOSE[@]}" exec -T db pg_dump -U vb_owner -d vaultbook --disable-triggers > "$WORK/db.sql"
[ -s "$WORK/db.sql" ] || { echo "pg_dump produced no output" >&2; exit 1; }

if [ "${SKIP_BLOBS:-0}" = 1 ]; then
  tar -cf "$WORK/blobs.tar" -T /dev/null
  BLOBS=0
else
  echo "Archiving photos (already ciphertext, encrypted again with the backup)..."
  "${COMPOSE[@]}" run --rm --no-deps -T --entrypoint tar app -C /data -cf - . > "$WORK/blobs.tar"
  BLOBS=1
fi

# openssl enc (CBC) is not authenticated, so the hashes inside the archive are the integrity check
( cd "$WORK" && { echo "created=$STAMP"; echo "blobs=$BLOBS"; sha256sum db.sql blobs.tar; } > MANIFEST )
tar -C "$WORK" -cf - MANIFEST db.sql blobs.tar \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -pass env:BACKUP_KEY -out "$OUT"
( cd "$BACKUP_DIR" && sha256sum "$(basename "$OUT")" > "$(basename "$OUT").sha256" )

# keep the newest $KEEP backups
ls -1t "$BACKUP_DIR"/vaultbook-*.tar.enc | tail -n +$((KEEP + 1)) | while read -r f; do rm -f "$f" "$f.sha256"; done

echo "Wrote $OUT"
echo "Copy it off this machine. Store BACKUP_KEY somewhere else."