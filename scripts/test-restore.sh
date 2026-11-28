#!/usr/bin/env bash
# Proves backup -> restore works on a throwaway database. Runs in CI; safe to run locally.
# Needs Docker. Does not build the app image (database only).
set -euo pipefail
cd "$(dirname "$0")/.."

export ENV_FILE=.env.selfhost.test SKIP_BLOBS=1 NO_APP=1 COMPOSE_PROJECT_NAME=vbrestoretest
export BACKUP_DIR="$(mktemp -d)"
rm -f "$ENV_FILE"
./scripts/keygen.sh "$ENV_FILE" > /dev/null
COMPOSE=(docker compose --env-file "$ENV_FILE" -f docker-compose.selfhost.yml)
cleanup() { "${COMPOSE[@]}" down -v > /dev/null 2>&1 || true; rm -f "$ENV_FILE"; rm -rf "$BACKUP_DIR"; }
trap cleanup EXIT

"${COMPOSE[@]}" up -d --wait db
PSQL=("${COMPOSE[@]}" exec -T db psql -U vb_owner -d vaultbook -v ON_ERROR_STOP=1 -tA)
q() { "${PSQL[@]}" -c "$1"; }

echo "Applying migrations..."
for f in src/server/db/migrations/*.sql; do "${PSQL[@]}" -q < "$f" > /dev/null; done

ORG=00000000-0000-0000-0000-000000000001
"${PSQL[@]}" -q > /dev/null <<SQL
INSERT INTO organizations (id, name, wrapped_dek) VALUES ('$ORG', 'Test', '\x01');
INSERT INTO products (org_id, sku, name, sell_price_cents) VALUES ('$ORG', 'R1', 'SecretRingName', 1000);
INSERT INTO stock_movements (org_id, product_id, type, qty, created_by) SELECT org_id, id, 'purchase'::movement_type, 5, 't' FROM products;
INSERT INTO stock_movements (org_id, product_id, type, qty, created_by) SELECT org_id, id, 'sale'::movement_type, -2, 't' FROM products;
SQL
[ "$(q 'SELECT stock_on_hand FROM products')" = 3 ] || { echo "fixture is wrong"; exit 1; }

./scripts/backup.sh
BACKUP="$(ls -1 "$BACKUP_DIR"/vaultbook-*.tar.enc | head -1)"
if grep -aq 'SecretRingName' "$BACKUP"; then echo "FAIL: backup contains plaintext"; exit 1; fi

# change things AFTER the backup; the restore must bring back the old state
"${PSQL[@]}" -q > /dev/null <<SQL
INSERT INTO products (org_id, sku, name, sell_price_cents) VALUES ('$ORG', 'EXTRA', 'Added after backup', 1);
SQL

./scripts/restore.sh "$BACKUP" --yes

check() { [ "$(q "$1")" = "$2" ] || { echo "FAIL: $1 -> expected $2, got $(q "$1")"; exit 1; }; }
check 'SELECT count(*) FROM products' 1
check 'SELECT stock_on_hand FROM products' 3
check 'SELECT count(*) FROM stock_movements' 2        # not doubled: triggers stayed off during load
check 'SELECT count(*) FROM price_history' 1          # not doubled either
check "SELECT relforcerowsecurity FROM pg_class WHERE relname = 'products'" t
check "SELECT count(*) FROM pg_policies WHERE tablename = 'cost_history'" 1
echo "Backup and restore round trip: OK"