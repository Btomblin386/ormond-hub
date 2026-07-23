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

## Backlog — added 2026-07
- **Instagram product tagging (Shopping)** — tag catalog products in feed
  posts/carousels (and Reels) so they're shoppable. Scopes already granted
  (`instagram_shopping_tag_products` + `catalog_management`). Build: pull the
  brand's catalog products (Catalog API), let the user pick products and
  position tags on the image in the composer, store `product_tags`, pass them at
  publish time (`product_tags: [{product_id, x, y}]` on the IG media container).
  Per-brand dependency: the IG account must be approved for Instagram Shopping
  with a catalog connected in Commerce Manager. High-priority per Brooks.
- **Meta Lead Ads → email routing** — in setup. Poll Meta leads per brand, email
  the shop each new lead with all fields in the body and Reply-To = the lead's
  email (hit-reply-to-respond). Reuses a shared email spine (Resend + send-email
  + email_log). Blocked on: `leads_retrieval` scope (done) + system user Manage
  Page on client Pages + Resend domain verify. See [[lead-ads-email-plan]].
- **Post email notifications** — approved/failed/needs-approval emails via the
  same email spine; per-user prefs. Build alongside Lead Ads email.
- **Account Manager role scoped to brands** — managers currently see all brands;
  add a user→brand assignment layer so each manager only sees their accounts.
- **Unified customer messaging / inbox + AI auto-response** — respond to FB/IG
  DMs/comments across monitored Pages from one place; AI-assisted replies. Scopes
  now granted (`pages_messaging`, `pages_utility_messaging`, `instagram_manage_messages`).
- **Page-growth & insights monitoring** — per-page follower/engagement trends
  (`read_insights`, `instagram_manage_insights`). See [[meta-permissions-roadmap]].

## Done
- **Smart Insights** — AI-flagged opportunities/issues per account (seasonality, sharp drops, trends).
- **Insights grouping + pinning** — grouped by category; pin to capture a baseline and track impact over 30 days.
- **Account chat** — free-form Q&A per account with full context (Supabase-hosted, no Vercel key needed).
- **Campaign Studio** — evaluates top campaigns vs. trending products, lists content/materials, drafts 3 campaigns to best audiences.
