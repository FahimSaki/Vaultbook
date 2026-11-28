# Design decisions

Short, honest reasons for the choices that shape Vaultbook.

**One codebase, three editions.** The original client needed a USB app, but a portfolio project and a real small shop both benefit from a server edition. A single schema and service layer means the portable build is not a fork; only the database driver, the auth gate and whether RLS applies change (`DEPLOY_MODE`).

**Portable first.** The USB constraint (offline, local, password-gated, no trace) is the hardest requirement and the riskiest to package, so it came first. The server editions reuse everything it produced.

**SQL-first migrations, typed Drizzle schema by hand.** Triggers, Row-Level Security and grants do not fit a generated-schema workflow. Migrations are plain numbered `.sql` files applied by a ~40-line runner that works with both drivers and wraps each file in a transaction. A test fails if the Drizzle schema drifts from what the migrations create. Files with `rls`, `auth` or `signup` in the name are hosted-only; the portable filter skips them.

**Drizzle, not a heavier ORM.** SQL stays visible, and it supports both `node-postgres` and PGlite behind one `Db` type.

**Row-Level Security and encryption, not one or the other.** RLS answers "who may read this row" even if application code has a bug (a staff member, another shop). Encryption answers "what does a leaked dump or stolen disk reveal". They defend different threats, so costs get both. The limit is spelled out in SECURITY.md: only costs and photos are encrypted at the application level in hosted modes.

**`withTenant()` is the only door.** It opens a transaction and sets `app.user_id`, `app.org_id` and `app.role` with `set_config(..., true)` so they last for that transaction only. That is what makes it safe behind a transaction pooler; a test checks it against a pooled Neon URL. An ESLint rule forbids importing the raw database client elsewhere.

**Test as the real role.** The PostgreSQL suite connects as `vb_app` (no superuser, no `BYPASSRLS`). Testing as a superuser bypasses every policy and passes for the wrong reason.

**Two-layer keys (KEK wraps DEK).** Changing a password, or rotating `MASTER_KEY`, re-wraps one 32-byte key instead of re-encrypting every row. AAD binds each ciphertext to its shop and product, so database write access cannot move a cost between products.

**Only standard-library crypto.** AES-256-GCM, scrypt, HKDF from `node:crypto`. No third-party crypto, no native dependency, nothing to compile on a locked-down PC.

**PGlite for the portable edition.** It is real Postgres in WebAssembly: the same SQL, triggers and constraints as the server edition, with no installer and nothing to run in the background. The cost is that the whole database lives in memory while unlocked.

**Sealed vault format and atomic saves.** `VBVAULT1` magic, salt, recovery-wrapped key, then the sealed database tarball. Saves write `vault.enc.tmp`, `fsync`, then rename, so a crash or a pulled stick leaves the previous file intact; a test kills the rename to prove it. Rotating `.bak` files are judged by the age of `.bak1` so five quick sessions cannot push out every older copy.

**Recovery code rotates with the password.** The KEK derives from the password, so a new password means a new KEK and the old recovery wrapper cannot be rebuilt. Rather than hide that, the app issues a new code and says the old paper is dead.

**Append-only history enforced twice.** `vb_app` is granted only `SELECT` and `INSERT` on history tables, and `BEFORE UPDATE OR DELETE` triggers refuse the rest, even for the table owner. The one exception is the demo reset, which uses the owner connection and `TRUNCATE` (which skips row triggers).

**Stock is a cached column guarded by a `CHECK`.** A trigger applies each movement, and `CHECK (stock_on_hand >= 0)` makes overselling impossible even with concurrent sales. The movements remain the source of truth, and the restore script verifies cached stock equals the sum of movements.

**Money is integer minor units, currency is a label.** Every amount is stored ×100 as an integer and shown with two decimals. A per-product currency code (default BDT) tags it; there is no conversion. Changing a price or currency writes a history row.

**Storage behind an interface; encryption as a decorator.** `LocalFsStore` and `S3Store` implement one small `BlobStore` interface, and `EncryptedStore` wraps either, so the provider only ever stores ciphertext and the hosted demo does not depend on one vendor.

**No installers, no network in portable mode.** Nothing is written outside the stick folder except a throwaway browser profile that is deleted on exit. The server binds to `127.0.0.1`, rejects foreign `Host` headers, and a Playwright test fails on any non-localhost request.

**AGPL-3.0 with an attribution term.** Anyone who runs a modified version as a service must publish their changes and keep the "Powered by Vaultbook" notice.

## Things I would do next

Key-rotation tooling, optional 2FA for the owner, an audit-log viewer, and a signed Windows launcher.
