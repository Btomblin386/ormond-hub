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

## Next up (account AI)
- **Account chat** — ask questions inside an account ("What would improve performance?", "Add a URL parameter to the FB campaign for better GA source matching"), answered with full account context. Needs ANTHROPIC_API_KEY added to Vercel.
- **Campaign-draft workflow** — evaluate recent high-performing campaigns vs. trending products, list the content/materials needed, then draft campaigns aimed at the highest-performing audiences. Builds on account chat + Meta ads_management (draft-and-approve, paused by default).

## Done
- **Smart Insights** — AI-flagged opportunities/issues per account (seasonality, sharp drops, trends).
- **Insights grouping + pinning** — grouped by category; pin to capture a baseline and track impact over 30 days.
