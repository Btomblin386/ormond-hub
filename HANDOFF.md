# Ormond Hub — Handoff / Architecture

A self-hosted agency hub for Ormond Brand Consulting: paid-ads management + analytics,
content scheduling/approval, brand listening, and repurposing — across ~5 brands.

## Stack & hosting
- **Frontend:** Next.js 14.2.5 App Router (JS, not TS). Deployed on **Vercel** from GitHub (`ormond-hub`).
- **Repo location:** `/Users/brookstomblin/Desktop/Ormond Hub` (moved out of Dropbox to avoid git lock issues).
- **Backend:** **Supabase** project `jxlrnuyfracyygiksqdj` — Postgres, Edge Functions (Deno), Storage, pg_cron.
- **Data layer:** `lib/db.js` uses `postgres.js` with a fresh per-request connection (`withDb`) over the
  Supabase **transaction pooler** (port 6543). NOTE: arrays/JSON must be cast (`${arr}::text[]`, `${JSON.stringify(x)}::jsonb`) — the pooler can't infer types.

## Vercel env vars
- `DATABASE_URL` — Supabase transaction pooler URI.
- `DASHBOARD_PASSWORD` — legacy agency password AND the HMAC signing key for per-user sessions.

## Auth & roles (lib/auth.js, lib/session.js, middleware.js)
- Legacy: `DASHBOARD_PASSWORD` → full **agency** access (cookie `hub_auth`). Zero lock-out.
- Per-user: `app_users` table (email, name, role, client_id, pass_hash/salt). Login issues a signed
  `hub_session` cookie (HMAC of payload with DASHBOARD_PASSWORD). Middleware verifies it in the Edge runtime.
- Roles: **agency** (all), **creator** (Content + Listen & Create only), **client** (their brand's Content only).
  Gating is enforced in `middleware.js` (routes + APIs), not just hidden in the UI.
- Manage users at `/team` (agency only) → `/api/users`.

## Supabase inventory
### Tables (public)
clients, ad_accounts, daily_metrics, ga4_* (properties/daily/product/product_monthly/store_monthly),
insights, pinned_insights, ad_writes, ad_rules, rule_events, campaign_plans, campaign_drafts, alerts,
social_accounts (per-client FB page + IG + page token), content_items (posts: status/schedule/variants/
post_type/first_comment/note/error_kind), brand_sources (meta/rss/hashtag/api), mention_items,
oauth_tokens (FB Login user tokens), app_users, user_profiles.

### Edge functions (SOURCE ONLY ON SUPABASE — download via `supabase functions download <name>`)
- meta-ingest, meta-backfill, meta-discover-accounts — Meta ads data.
- ga4-ingest, ga4-history — GA4 via service-account JWT.
- generate-insights, account-chat, campaign-plan — AI (Anthropic).
- meta-create (v5), meta-manage (v2) — write campaigns/ads with guardrails + audit; applies account url_params.
- meta-upload-image, meta-audiences.
- content-upload — stores image (base64 or url) to `content-media` public bucket.
- content-publish (v5) — publishes approved/scheduled content to FB/IG (feed/reel/story), first comment,
  transient-vs-permanent error classification.
- social-manage — discover/connect FB pages + IG.
- brand-listen (v8) — polls brand_sources: meta (tags/visitor posts/IG tags), hashtag (IG hashtag search),
  rss; sets mtype + thumbnails.
- meta-interact — reply/like on mentions (prefers per-page token).
- meta-webhook (verify_jwt off) — real-time IG story mentions + comments/mentions. Verify token `ormondhub_meta_2026`.
- meta-subscribe — subscribe pages to webhooks.
- oauth-facebook — FB Login onboarding (exchange/list/connect).
- run-rules — evaluates ad_rules (perf + creative fatigue), auto-pause/notify.
- meta-listen-check — temporary diagnostic (can delete).

### Supabase secrets
META_ACCESS_TOKEN (system-user, all scopes for pages/IG read+publish), META_APP_SECRET (OAuth),
ANTHROPIC_API_KEY, GA4 service account, BRAND_LISTENER_API_KEY (optional), SUPABASE_URL/SERVICE_ROLE (auto).

### Storage
`content-media` public bucket (post images, story-mention media, composited repurpose images).

### pg_cron jobs
Meta/GA4 ingests (12/17/21 UTC), run-rules (12:35/17:35/21:35), content-publish (*/15), brand-listen (every 6h).

## Meta app
"OBC Content Scheduler" (App ID 1516438426621167), LIVE. Use cases: Marketing API, Page, IG messaging+content.
Webhook callback: `https://jxlrnuyfracyygiksqdj.supabase.co/functions/v1/meta-webhook`, verify `ormondhub_meta_2026`.
FB Login redirect URI to whitelist: `https://<prod-domain>/api/oauth/facebook/callback`.

## Key frontend structure
- `app/page.js` — Agency Overview (notifications + cross-account content calendar + KPIs). **Slated for redesign.**
- `app/accounts/[id]/page.js` — Paid Marketing (KPIs, insights, campaign studio, campaigns, ads manager, rules).
- `app/accounts/[id]/content/page.js` — Content (Posts composer + Calendar). `?edit=<id>` opens composer in edit mode.
- `app/accounts/[id]/engage/page.js` — Listen & Create (Brand Listener + Repurpose Studio).
- Routing is **client-centric**: route param = client_id; a brand shows if it has an ad account OR a social connection.
- Components: ContentManager (composer+list), ContentCalendar (drag-reschedule, right-click-create, quick-edit modal),
  ContentBoard, EngageBoard, BrandListener, RepurposeStudio, RulesManager, AdsManager, CampaignStudio, Shell, AccountTabs,
  NotificationsFeed, TeamManager, OnboardClient. Media utils in `lib/media.js` (crop/upload-progress/video-validate).

## Pending backlog (in priority order chosen by Brooks)
1. **Agency Overview redesign** — replace blended spend/revenue chart with per-account 7-day trend + green/red
   delta arrows; click opens a quick-analytics window (% change, adjustable dates). (NEXT)
2. **Actionable Campaign Studio chat** — make the chat DO things (e.g. add UTM params to live campaigns) with
   guardrails + approval, instead of only giving instructions.
Also requested (not yet scheduled):
- Repurpose Studio rework (fix brand-kit fit / black-bars, matching buttons; possible Canva integration later).
- Dropbox integration (browse + pin a default folder per brand to grab photos).
- Interactive crop (drag-to-position live preview) — current crop is center-crop only.
- Social insights tab (pin/enter starting stats + date, track over selectable periods).
- Push/email alerts for approvals + missed schedules (currently in-app notifications only).
- Full top-nav conversion (OneUp-style) — layout is widened but nav still left-rail.

## Gotchas
- Git-in-Dropbox caused lock collisions → repo moved to Desktop. If `.git/*.lock` sticks, `rm -f .git/*.lock`.
- postgres.js on the pooler: cast arrays/json (see Data layer).
- Edge function source is not in the repo — download from Supabase to edit locally.
