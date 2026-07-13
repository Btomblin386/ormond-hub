# Ormond Hub — Backlog

Focused scope: **Ad Management · Analytics · Content · Brand Listener.** (Not a CRM.)
One task at a time.

## Parked (recorded, not yet started)
- **Brand Listener** — generates an RSS feed of brand mentions + tags. Prior work exists in an earlier session; when ready, pull it up and integrate as its own hub module (data source → Supabase on a schedule → page with filters + per-client feeds). Owner: Brooks. Priority: after current analytics/content work.

## Known future work
- **Google Ads ingestion** — completes the paid picture (GA4 shows Google is Slavens' biggest driver). Needs Google Ads API developer-token application (1–4 wk approval).
- **Content module** — creation + scheduling calendar; replaces GoHighLevel (~$300/mo).
- **Client logins** — per-client scoped portal (RLS already built).
- **Next.js security bump** — 14.2.5 has an advisory; move to a patched 14.2.x.
- **DST** — cron times set in UTC for CDT; shift 1 hr when Central goes to Standard time (Nov).

## In progress
- **Smart Insights** — AI-flagged opportunities/issues per account (seasonality, sharp drops, trends).
