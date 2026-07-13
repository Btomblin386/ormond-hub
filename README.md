# Ormond Hub

Private ad-performance + Meta↔GA4 reconciliation dashboard for Ormond Brand Consulting.
Next.js (App Router) reading live from Supabase, deployed on Vercel.

## What's here

- **Dashboard** (`/`) — Meta ad performance across all accounts (spend, revenue, blended ROAS, conversions) with a daily trend and a per-account table. 7/30/90-day toggle.
- **Reconciliation** (`/reconciliation`) — Meta's reported (pixel) revenue vs. GA4 last-click revenue for Slavens Racing, plus a per-product breakdown of how much Meta actually drives.
- Single-password gate (private v1). Data is served server-side; the DB credential never reaches the browser.

Data is written to Supabase by scheduled functions (Meta + GA4 ingest, 3×/day). This app only reads.

## Environment variables

Set these in Vercel (Project → Settings → Environment Variables) and, for local dev, in a `.env` file (see `.env.example`):

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection string → **Transaction** (URI, port 6543). Replace `[YOUR-PASSWORD]` with your DB password. |
| `DASHBOARD_PASSWORD` | Any password you choose — this is what you type to access the site. |

## Deploy (GitHub + Vercel)

From this folder:

```bash
git init
git add .
git commit -m "Ormond Hub v1: dashboard + reconciliation"
git branch -M main
git remote add origin https://github.com/<your-username>/ormond-hub.git   # create this empty repo on GitHub first
git push -u origin main
```

Then in Vercel:

1. **Add New → Project → Import** your `ormond-hub` GitHub repo.
2. Framework preset auto-detects **Next.js** — leave defaults.
3. Add the two **Environment Variables** above.
4. **Deploy.**

Every `git push` to `main` after this auto-deploys. To ship an update: edit, commit, push.

## Local development

```bash
npm install
cp .env.example .env   # then fill in DATABASE_URL and DASHBOARD_PASSWORD
npm run dev            # http://localhost:3000
```

## Notes / next steps

- **Reconciliation currently covers Slavens Racing** (the only client with GA4 connected). Add another client's GA4 property to the service account, then it flows in automatically.
- **Auth is a simple shared password** for the private v1. Client-facing logins (per-brand, scoped) are the planned next phase — the Supabase schema already has the row-level security for it.
- Cron flips: scheduled pulls run at 7am / 12pm / 4pm Central (set in UTC; nudge by an hour when Central switches to Standard time in November).
