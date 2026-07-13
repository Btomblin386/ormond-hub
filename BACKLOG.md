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

## Next up
- **Push drafts to Meta (paused)** — take a Campaign Studio draft and create it in Meta as PAUSED for review/approval, then one-click activate. Uses Meta ads_management (already granted). Needs creative handling (image/video upload or reference).

## Done
- **Smart Insights** — AI-flagged opportunities/issues per account (seasonality, sharp drops, trends).
- **Insights grouping + pinning** — grouped by category; pin to capture a baseline and track impact over 30 days.
- **Account chat** — free-form Q&A per account with full context (Supabase-hosted, no Vercel key needed).
- **Campaign Studio** — evaluates top campaigns vs. trending products, lists content/materials, drafts 3 campaigns to best audiences.
