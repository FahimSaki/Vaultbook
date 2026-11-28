# Security

Vaultbook handles prices and costs that small shops treat as confidential. This document says exactly what it protects, how, and what it does **not** protect against.

## Reporting a vulnerability

Use GitHub's private reporting: the repository's **Security** tab → **Report a vulnerability**. Please do not open a public issue for a security problem.

## What is protected

| Asset                                        | Where                   | Protection                                                                                                                                                                                                        |
| -------------------------------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Entire database (portable)                   | `data/vault.enc`        | AES-256-GCM, key derived from the password with scrypt (N=2^17, r=8, p=1). Authenticated: a wrong password or any flipped byte fails to open. No plaintext database file on disk.                                 |
| Product photos                               | `data/blobs` or S3      | Encrypted with a key derived (HKDF) from the shop's data key, bound to the object key through AAD. Re-encoded to WebP so EXIF and GPS data are removed. Served only through authenticated routes with `no-store`. |
| Cost prices                                  | `cost_history.cost_enc` | AES-256-GCM under the shop's data key, bound to shop and product through AAD, so a ciphertext cannot be moved to another product.                                                                                 |
| Costs, audit log, other shops' rows (hosted) | PostgreSQL              | Row-Level Security with `FORCE ROW LEVEL SECURITY`, enforced for the non-superuser `vb_app` role. Roles come from the database (`memberships`), never from the client.                                            |
| History (prices, stock, costs, audit)        | PostgreSQL              | Append-only: `UPDATE` and `DELETE` are refused by triggers, and `vb_app` has no such privilege.                                                                                                                   |
| Selling prices and currency                  | PostgreSQL              | A trigger raises `42501` if a non-owner changes them.                                                                                                                                                             |

### Key hierarchy

```
password (portable) or MASTER_KEY (hosted) → KEK → wraps DEK (one per shop) → encrypts costs, derives the image key
```

Unwrapped data keys live only in server memory (hosted: short in-process cache, 5 minutes). Keys are zeroed when the portable vault locks.

### Portable edition specifics

- Listens on `127.0.0.1` only, rejects any `Host` header that is not localhost, and the packaged app makes no outbound requests (verified by a Playwright test).
- One owner. A signed, `httpOnly`, `SameSite=Strict` cookie whose signing secret is random per process start; restarting the app invalidates it.
- Wrong-password attempts are delayed (2, 4, 8... up to 60 seconds). The delay protects the running server; scrypt cost is what slows offline attacks on a stolen file.
- Saves write a temp file, flush, and atomically rename. Rotating `vault.enc.bak1..5` copies are kept.
- Auto-lock after 15 minutes idle; the Lock button and process exit seal the vault and wipe keys.
- The launcher uses a throwaway Chrome/Edge profile in private mode and deletes it on exit. Every response is `Cache-Control: no-store`.
- **Recovery:** a random recovery code (shown once) wraps the key. Changing the password issues a **new** code and kills the old one. If both password and code are lost, the data cannot be recovered. This is deliberate.

### Hosted editions specifics

- Passwords of 12+ characters (Better Auth, email and password). Sign-up closes after the first account unless `ALLOW_SIGNUP=1`. The owner creates staff accounts.
- Content-Security-Policy, `X-Content-Type-Options`, `Referrer-Policy: no-referrer`, `frame-ancestors 'none'` in production.
- CSV export neutralises spreadsheet formulas; staff exports have no cost column.
- Backups (`scripts/backup.sh`) are encrypted with `BACKUP_KEY` and checked against hashes recorded inside the archive.

## What is NOT protected

State these honestly to anyone you give the software to.

1. **A malicious or compromised server administrator** in self-host or cloud mode can read decrypted data while the app runs (the master key and data keys are in its memory and environment).
2. **Malware on the owner's computer** while the portable vault is unlocked can read everything the owner can.
3. **A forgotten password and a lost recovery code.** There is no backdoor.
4. **In hosted modes, only costs and photos are encrypted at the application level.** Product names, selling prices, stock levels, movements and the audit log are ordinary Postgres data. Anyone with the database or a dump sees them. Treat the database host as trusted for that data, or use portable mode (the whole database is sealed).
5. **Losing `MASTER_KEY`** makes the encrypted costs and photos unrecoverable. Losing `BACKUP_KEY` makes backups unreadable.
6. **Memory and swap.** Decrypted data lives in RAM while unlocked and cannot be fully prevented from being paged to the host disk by the operating system. Browser traces may remain if the launcher falls back to the default browser. Use computers you trust.
7. **Weak passwords.** The vault is only as strong as its passphrase. Use a long one.
8. **Traffic on your network** if you expose the self-host edition without HTTPS. Put it behind a TLS proxy (Caddy).
9. **Backups are not authenticated by the cipher.** `backup.sh` uses `openssl enc` (AES-256-CBC with PBKDF2). Integrity comes from SHA-256 hashes stored in the archive, which are checked on restore. An attacker who can modify the file can make a restore fail but cannot read it.

## Known gaps

No 2FA, no key-rotation tool (a version byte is stored with every ciphertext so one can be added), no audit-log viewer page, and login rate limiting relies on the auth library's defaults, which are not independently tested here.

## Hardening checklist for self-hosters

- Keep the database port unpublished (the provided compose file does).
- Serve over HTTPS and set `BETTER_AUTH_URL` to the real address.
- Store `MASTER_KEY` and `BACKUP_KEY` offline, apart from the backups.
- Run `./scripts/backup.sh` on a schedule and copy the files off the machine. Test a restore.
- Keep Docker images and dependencies updated; Dependabot is enabled on the repository.

## Cryptography

Nothing custom. AES-256-GCM (12-byte random IV, 16-byte tag, version byte), scrypt, HKDF-SHA-256 and HMAC-SHA-256 from the Node.js standard library. The ciphertext layout is `version(1) | iv(12) | tag(16) | ciphertext`.
