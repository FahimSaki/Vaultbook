# Deploying the hosted demo (Vercel + Neon + S3-compatible storage)

The demo is the `cloud` edition of the same code, filled with fake data and reset every night.
Free-tier limits and terms change, so check each provider's current pricing page first.

## 1. Neon (database)

1. Create a project. Copy two connection strings from the dashboard: the **direct** one and the **pooled** one (its host contains `-pooler`).
2. In the Neon **SQL editor** (not the Roles UI), create the app role:
   ```sql
   CREATE ROLE vb_app LOGIN PASSWORD 'a-long-random-password' NOSUPERUSER NOBYPASSRLS;
   SELECT rolbypassrls FROM pg_roles WHERE rolname = 'vb_app';   -- must be: f
   ```
   Roles created through the Neon console may get `BYPASSRLS`. `vb_app` must not, or every policy is silently skipped.
3. Run the migrations once as the **owner** role (`neondb_owner`, direct URL). `0002_rls.sql` grants to `vb_app`, so the role must exist first:
   ```bash
   MIGRATION_DATABASE_URL='postgres://neondb_owner:...@ep-xxx.../neondb?sslmode=require' pnpm exec tsx scripts/migrate.ts
   ```
4. Build the `vb_app` connection strings by swapping the user and password into the same hosts:
   `DATABASE_URL` = pooled host + `vb_app`; `SEED_DATABASE_URL` = direct host + owner role.
5. Create a second Neon **branch** for tests and run `tests/pooled.test.ts` against it (see the header of that file).

## 2. Photo storage

Any S3-compatible bucket works (Cloudflare R2, Supabase Storage, Backblaze B2...). Create a private bucket and an access key, then note `S3_BUCKET`, `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. The bucket only ever holds ciphertext (`EncryptedStore`), and nothing in it is public.

## 3. Seed it once from your laptop

```bash
cp .env.demo.example .env.demo   # fill it in
pnpm db:seed-demo                # add this script: "db:seed-demo": "tsx --env-file=.env.demo scripts/seed-demo.ts"
```

## 4. Vercel

Import the GitHub repo. Set these environment variables (Production):

| Variable             | Value                                                                     |
| -------------------- | ------------------------------------------------------------------------- |
| `DEPLOY_MODE`        | `cloud`                                                                   |
| `DATABASE_URL`       | pooled URL, role `vb_app`                                                 |
| `SEED_DATABASE_URL`  | direct URL, owner role (used only by the nightly reset)                   |
| `MASTER_KEY`         | `openssl rand -base64 32` (the same value you used to seed)               |
| `BETTER_AUTH_SECRET` | `openssl rand -hex 32`                                                    |
| `BETTER_AUTH_URL`    | `https://<your-project>.vercel.app`                                       |
| `S3_*`               | from step 2                                                               |
| `DEMO`               | `1`                                                                       |
| `CRON_SECRET`        | `openssl rand -hex 32` (Vercel sends it as a bearer token to cron routes) |

Do **not** set `MIGRATION_DATABASE_URL` or `ALLOW_SIGNUP` on Vercel. `vercel.json` already schedules `/api/cron/reset-demo` for 03:00 UTC daily.

Trigger the first reset by hand to prove it works:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://<your-project>.vercel.app/api/cron/reset-demo
```

## 5. Keep the schema current

Add the repository secret `DEMO_MIGRATION_DATABASE_URL` (owner, direct). `.github/workflows/demo-migrate.yml` then applies new migrations whenever `main` changes. Keep migrations additive so the old deployment keeps working while the new one rolls out.

## If something breaks

- **Build or runtime error mentioning PGlite or sharp:** `vault.ts` imports PGlite statically. Both packages are in `serverExternalPackages`; check the function logs for a missing `.wasm` or native binary.
- **Logged in but "no shop":** the seed did not finish. Run the reset route again and read its response.
- **Staff can see costs:** `vb_app` has `BYPASSRLS`. Re-check step 1.2.
- **Reset times out:** raise `maxDuration` in the route, or seed with `photos: false` in `seedDemo`.
