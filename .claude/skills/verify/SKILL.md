---
name: verify
description: Run Ormond Hub locally against a seeded throwaway Postgres and drive it in a browser to verify changes.
---

# Verifying Ormond Hub locally

The app needs `DATABASE_URL` (Postgres) + `DASHBOARD_PASSWORD`. Production DB is Supabase;
for verification use a local Docker Postgres. **Gotcha: `lib/db.js` forces `ssl: "require"`,
so plain local Postgres fails — the container must have SSL enabled** (self-signed cert is fine;
postgres.js doesn't verify it).

## Recipe that works

1. **Postgres with SSL + schema + seed** — init dir with two files mounted at
   `/docker-entrypoint-initdb.d`:
   - `01-ssl.sh`: `openssl req -new -x509 -nodes -subj "/CN=localhost" -keyout /var/lib/postgresql/server.key -out /var/lib/postgresql/server.crt`, `chmod 600` the key, append `ssl = on` + cert paths to `$PGDATA/postgresql.conf`.
   - `02-schema.sql`: DDL + seed. Get real column lists from Supabase (`information_schema.columns` via the Supabase MCP) — don't guess. `daily_metrics.id` is `bigint generated always as identity`.

   ```bash
   docker run -d --name ormond-verify-pg -p 54329:5432 -e POSTGRES_PASSWORD=pgtest \
     -e POSTGRES_DB=ormond -v <initdir>:/docker-entrypoint-initdb.d postgres:17
   ```

2. **.env** (gitignored): `DATABASE_URL=postgres://postgres:pgtest@localhost:54329/ormond`,
   `DASHBOARD_PASSWORD=<anything>`.

3. **Run**: `./node_modules/.bin/next dev -p 3100` (use the local binary — bare `npx next` grabs
   the wrong major version if node_modules is missing; `npm install` first).

4. **Login**: POST `/api/login` with form field `password=<DASHBOARD_PASSWORD>` (legacy agency),
   or `email`+`password` for a seeded `app_users` row. Hash for seeding:
   `pbkdf2Sync(pw, salt, 100000, 32, "sha256").toString("hex")` (see `lib/auth.js`).
   With curl use a cookie jar; with Playwright just drive the `/login` form.

5. **Drive**: Playwright (install in a scratch dir, not the repo). Capture `console` errors —
   recharts emits benign `defaultProps` deprecation warnings; ignore those.

## Seed shape that exercises the overview well

- 3 clients: one ads+rising revenue, one ads+falling revenue, one content-only (social_accounts row,
  no ad_account) — the content-only brand must appear in the Accounts table but not the trend grid.
- Don't hand-minimize table columns — mirror them from production `information_schema.columns`.
  Pages join more than you expect (e.g. the Google tab joins ga4_properties → oauth_tokens; ga4_product
  needs purchases/window_start/window_end). Missing relations 500 the whole page.
- 30 days of `daily_metrics` per ad account (linear ramps make deltas hand-checkable).
- content_items: one `needs_approval` undated, one `approved` future-dated, one overdue `draft`.
- One `insights` row + one `ad_rules`/`rule_events` pair → populates all notification buckets.

## Role probes

- Creator (`app_users.role='creator'`) → paid APIs return 403 JSON; `GET /` redirects to `/accounts`.
- No cookie → 307 to `/login`.

## Teardown

`docker rm -f ormond-verify-pg`; delete `.env` or repoint it at Supabase.
