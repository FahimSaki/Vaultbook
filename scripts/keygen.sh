#!/usr/bin/env bash
# Creates an env file with random secrets. Refuses to overwrite an existing file.
#   ./scripts/keygen.sh              -> .env.selfhost
#   ./scripts/keygen.sh other.env    -> other.env
set -euo pipefail
cd "$(dirname "$0")/.."
OUT="${1:-.env.selfhost}"
if [ -f "$OUT" ]; then echo "$OUT already exists; refusing to overwrite" >&2; exit 1; fi
umask 077
cat > "$OUT" <<EOT
DB_OWNER_PASSWORD=$(openssl rand -hex 24)
DB_APP_PASSWORD=$(openssl rand -hex 24)
MASTER_KEY=$(openssl rand -base64 32)
BETTER_AUTH_SECRET=$(openssl rand -hex 32)
BACKUP_KEY=$(openssl rand -base64 32)
BETTER_AUTH_URL=http://localhost:3000
ALLOW_SIGNUP=0
EOT
echo "Created $OUT."
echo "Keep an offline copy of MASTER_KEY and BACKUP_KEY, stored apart from your backups:"
echo "  MASTER_KEY  - without it the encrypted costs and photos cannot be recovered."
echo "  BACKUP_KEY  - without it your backup files cannot be opened."