# Vaultbook

**Privacy-first inventory and pricing for small shops.** Track products, photos, selling prices, stock and a buy list. Only the owner sees costs and margins. Your data never has to touch someone else's server: the cloud is optional.

> Built after a jewelry-store client refused cloud software. The first version was a USB-stick app. Vaultbook is its web successor, with the same promise: plug it in, use it, leave no trace.

[![ci](https://github.com/FahimSaki/Vaultbook/actions/workflows/ci.yml/badge.svg)](https://github.com/FahimSaki/Vaultbook/actions/workflows/ci.yml)

**Live demo:** https://YOUR-DEMO.vercel.app (fake data, reset daily)
Owner `owner@demo.example` / `owner-demo-pass` · Staff `staff@demo.example` / `staff-demo-pass`
Log in as both and compare: the staff account never sees a cost, a margin or an audit entry.

<!-- add a screenshot or short GIF here -->

## Three ways to run it

|                    | **Portable**                                                 | **Self-host**                                   | **Hosted demo**               |
| ------------------ | ------------------------------------------------------------ | ----------------------------------------------- | ----------------------------- |
| For                | A privacy-skeptical single owner                             | A shop with a PC or cheap VPS, owner plus staff | Recruiters and interviewers   |
| Data lives in      | One encrypted file, `vault.enc`, on a USB stick or folder    | Your own Postgres in Docker                     | Free-tier Postgres, fake data |
| Database           | PGlite (Postgres compiled to WASM), in memory while unlocked | PostgreSQL 16                                   | PostgreSQL (Neon)             |
| Users              | One owner, unlocked with a password                          | Owner and staff accounts                        | Owner and staff demo accounts |
| Network            | None. Binds to `127.0.0.1` only                              | Yours to expose                                 | Public                        |
| Row-Level Security | n/a (single owner)                                           | Yes                                             | Yes                           |

One codebase, one schema. `DEPLOY_MODE` (`portable` / `selfhost` / `cloud`) picks the database driver and the auth gate.

## Features

- Products with SKU, category, description, selling price, **per-product currency** (default BDT, stored as integer minor units, never floats), reorder level and cached stock.
- Photos (up to 10 per product, 5 MB each): the real file type is checked, re-encoded to WebP (this strips EXIF and GPS), thumbnails are generated, and everything is stored **encrypted**. Images are served only through authenticated routes.
- Append-only history: every selling-price change, every stock movement, every cost, every audit entry. Triggers refuse `UPDATE` and `DELETE`.
- Stock that cannot go negative (a database `CHECK`, so two cashiers selling the last item cannot both succeed).
- Buy list with automatic suggestions when stock reaches the reorder level.
- Dashboard: stock value at selling price, low stock, top sellers; owner-only stock value at cost.
- CSV import (all-or-nothing, row-numbered errors, 5,000 rows) and export (staff files have no cost column; formula-injection guarded).
- Owner-only costs and margins, protected twice: by Postgres policies and by encryption.

## Privacy and security in one minute

- **Portable:** the whole database is sealed with AES-256-GCM under a key derived from your password with scrypt. A wrong password cannot decrypt anything. Auto-lock after 15 idle minutes. A recovery code (shown once, write it on paper) is the only way back if you forget the password. Lose both and the data is gone, by design.
- **Self-host / hosted:** cost prices are encrypted at the application level and readable only by the owner role; a leaked database dump does not reveal them. Shops are isolated from each other and staff from costs by Postgres Row-Level Security, not by hiding buttons.
- **What it does not protect against** is written down in [SECURITY.md](SECURITY.md). Read it before trusting this with real data.

Nothing here is invented cryptography: it is AES-256-GCM and scrypt from the Node.js standard library.

## Quick start

### Portable (USB)

1. Download `vaultbook-portable-Windows.zip` (or `-Linux.zip`) from the [Releases](https://github.com/FahimSaki/Vaultbook/releases) page and unzip it onto the stick (format it exFAT).
2. Double-click `start.bat` (Windows) or run `start.sh` (Linux, macOS).
3. First run: choose a passphrase of 12+ characters and **write the recovery code on paper**.
4. Close the browser window when you are done. Vaultbook seals the vault and exits. Never pull the stick while the black window is open.

Back up from **Settings → Download encrypted backup**, or copy the whole `data` folder to a second stick.

The launcher opens Chrome or Edge in a throwaway private profile and deletes it on exit. If neither is installed it falls back to your default browser, which may keep history.

### Self-host (Docker)

```bash
git clone https://github.com/FahimSaki/Vaultbook.git && cd Vaultbook
./scripts/keygen.sh
docker compose --env-file .env.selfhost -f docker-compose.selfhost.yml up -d --build
```

Open http://localhost:3000. The first account you create becomes the owner of the shop; add staff from the **Team** page. Sign-up closes after the first user unless you set `ALLOW_SIGNUP=1`.

- Keep an offline copy of `MASTER_KEY` (without it the encrypted costs and photos cannot be recovered) and `BACKUP_KEY`.
- For other devices on your network or a VPS, put Caddy in front: `shop.example.com { reverse_proxy app:3000 }`, and set `BETTER_AUTH_URL` to the public address.
- **Backups:** `./scripts/backup.sh` writes an encrypted `backups/vaultbook-<date>.tar.enc` (database plus photos). Restore with `./scripts/restore.sh <file>`. CI restores a backup on every push (`scripts/test-restore.sh`), because a backup you never restored is not a backup.
- **Update:** `git pull`, then rerun the `up -d --build` command. Migrations run on start.

### Development

```bash
pnpm install
pnpm dev                 # portable mode by default; open http://localhost:3000/setup
pnpm typecheck && pnpm lint && pnpm test
```

Hosted mode locally:

```bash
docker compose up -d     # dev Postgres on 127.0.0.1:5433, creates the vb_app role
# .env.local: DEPLOY_MODE=selfhost, DATABASE_URL=postgres://vb_app:devpassword@127.0.0.1:5433/vaultbook,
#             MIGRATION_DATABASE_URL=postgres://vb_owner:devpassword@127.0.0.1:5433/vaultbook,
#             MASTER_KEY=$(openssl rand -base64 32), BETTER_AUTH_SECRET=$(openssl rand -hex 32)
pnpm db:migrate && pnpm dev
```

Seed demo data: `pnpm db:seed` (portable, password `demo-password-123`) or `pnpm db:seed --large` for 5,000 products and 100,000 movements.

## Architecture

```mermaid
flowchart TD
  UI["Browser: Next.js UI"] --> SA["Server Actions / Route Handlers"]
  SA --> SVC["Services (business rules, Zod validation)"]
  SVC --> TEN["withTenant(): sets app.org_id, app.user_id, app.role per transaction"]
  SVC --> CR["Crypto: AES-256-GCM, scrypt, HKDF"]
  SVC --> ST["Storage: local disk or S3, wrapped by EncryptedStore"]
  TEN --> PG[("PostgreSQL 16<br/>self-host / cloud<br/>RLS enforced")]
  TEN --> PL[("PGlite in memory<br/>portable<br/>sealed into vault.enc")]
```

The UI never touches the database. The flow is always UI → Server Action → service → Drizzle query inside `withTenant()`. An ESLint rule forbids importing the raw `db` anywhere else.

### Data model

```mermaid
erDiagram
  organizations ||--o{ memberships : has
  organizations ||--o{ categories : has
  organizations ||--o{ products : owns
  categories ||--o{ products : groups
  products ||--o{ product_images : has
  products ||--o{ price_history : "logs (append-only)"
  products ||--o{ stock_movements : "logs (append-only)"
  products ||--o{ cost_history : "logs (append-only, encrypted)"
  stock_movements ||--o| cost_history : "may record"
  organizations ||--o{ buy_list_items : tracks
  products ||--o{ buy_list_items : suggests
  organizations ||--o{ audit_log : "logs (append-only)"
```

### Key hierarchy

```
Owner password (portable)  or  MASTER_KEY secret (self-host / cloud)
        │  scrypt (password)  /  used directly (secret)
        ▼
KEK  (32 bytes, never stored)
        │  AES-256-GCM wraps
        ▼
DEK  (32 random bytes per shop, stored wrapped in organizations.wrapped_dek)
        ├─ encrypts cost_history.cost_enc  (bound to shop and product through AAD)
        └─ HKDF → image key (photos on disk or in S3 are ciphertext)
```

Changing the password or rotating `MASTER_KEY` means re-wrapping one small DEK, not re-encrypting every row.

## Testing and CI

- **Unit and service tests** (Vitest) run on PGlite: crypto (round trip, tampering, wrong key, wrong AAD), the sealed vault (round trip, wrong password, flipped byte, crash during save keeps the old vault, recovery code, password change), stock rules, CSV, buy list, images, backup tar, currency, schema drift.
- **PostgreSQL tests** run the same suite against PostgreSQL 16 **as the `vb_app` role** (not a superuser, which would bypass every policy and pass for the wrong reason): shop isolation, owner-only costs, staff cannot change prices or currency, append-only enforcement, oversell, and two parallel sales of the last unit where exactly one wins.
- **Playwright** drives the portable build and fails if the browser makes any request to a non-localhost host.
- **Restore test** takes a backup, changes the database, restores, and checks that nothing was applied twice.
- **Releases**: tagging `v*` builds the portable zips on Windows and Linux runners and smoke-tests the packaged build (the migrations, PGlite's WASM and sharp's native binary) before publishing.

## Performance

<!-- Fill in from `pnpm db:seed --large` (it prints EXPLAIN ANALYZE timings), before and after any index you add:
| Query | Before | After |
| --- | --- | --- |
-->

Dashboard queries were measured on a seeded 5,000-product, 100,000-movement database with `EXPLAIN ANALYZE`; see `scripts/seed.ts`.

## Design decisions

See [docs/decisions.md](docs/decisions.md). Short version: SQL-first migrations, Row-Level Security **and** application-level encryption, PGlite for the offline edition, append-only history enforced by triggers, integer minor units for money, storage and database drivers behind interfaces.

## Known limitations

- Portable mode is single-owner. The working copy of the database is in memory while unlocked, and a crash can lose the last couple of seconds of edits (the previous vault file and rotating backups stay intact).
- In self-host and cloud modes only costs and photos are encrypted at the application level. Product names, selling prices and stock are ordinary Postgres data.
- No 2FA, no key-rotation tool yet, no audit-log viewer page (entries are recorded).
- Portable mode cannot stop the host operating system from paging memory to disk, or from keeping browser traces if the launcher falls back to the default browser. Use computers you trust.
- Currency is a per-product label; there is no conversion and no multi-currency totals (the dashboard groups by currency).

## License

AGPL-3.0, with the attribution requirement in the `LICENSE` file (section 7 additional terms). Any modified version or service based on this software must display: "Powered by Vaultbook – (https://github.com/FahimSaki/Vaultbook.git)" in its documentation, README or legal notice.
