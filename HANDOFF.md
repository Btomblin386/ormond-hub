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
- `GOOGLE_OAUTH_CLIENT_ID` — Google OAuth web client (the SECRET lives only in Supabase secrets).

## Google OAuth setup (one-time, Brooks)
1. Google Cloud Console → new project (or reuse) → enable **Google Analytics Data API**, **Google Analytics
   Admin API**, and **Google Ads API**.
2. OAuth consent screen: External; scopes `analytics.readonly`, `adwords`, `email`; add yourself as test user
   (or publish).
3. Credentials → OAuth client ID (Web application). Authorized redirect URIs:
   `https://<prod-domain>/api/oauth/google/callback` (+ `http://localhost:3000/api/oauth/google/callback` for dev).
4. Set `GOOGLE_OAUTH_CLIENT_ID` in Vercel + `.env`; set `GOOGLE_OAUTH_CLIENT_ID` and
   `GOOGLE_OAUTH_CLIENT_SECRET` in Supabase → Edge Functions → Secrets.
5. `/onboard` → Continue with Google → pick GA4 properties per client. Data flows on the next ingest cron.
6. Google Ads: apply for the developer token (1–4 wk) — OAuth consent is already collected; ingestion is the
   remaining build.

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
- ga4-ingest (v8), ga4-history — GA4. Per-property auth: `ga4_properties.auth_kind` = 'service_account'
  (GA4_SA_JSON, legacy/Slavens) or 'oauth' (refresh token in oauth_tokens via `oauth_token_id`).
- oauth-google — Google OAuth onboarding (exchange/list GA4 properties/connect). Scopes requested up front:
  analytics.readonly + adwords (Google Ads ingestion becomes possible once the developer token is approved;
  consent is already banked in oauth_tokens.scopes). Secrets: GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET.
- generate-insights (v6), account-chat (v5), campaign-plan (v6) — AI (Anthropic). All three read the brand's
  identity from `clients.brand_settings.business_desc` (+ brand_voice) — set per brand in the Repurpose Studio
  brand kit; NEVER hardcode a vertical in these prompts. account-chat can emit a ```proposal``` JSON fence
  (update_status / update_budget / create_campaign / set_url_params) that the hub renders as a confirm card.
- analytics-summary — AI phrasing of a date-range's KPIs for the overview quick-analytics modal (stateless).
- meta-create (v5), meta-manage (v2) — write campaigns/ads with guardrails + audit; applies account url_params.
- meta-upload-image, meta-audiences.
- content-upload — stores image (base64 or url) to `content-media` public bucket.
- content-publish (v6) — publishes approved/scheduled content to FB/IG (feed/reel/story), first comment,
  transient-vs-permanent error classification. Reliability: skips channels that already have a post id
  (no double-post on retry of a half-failed multi-channel post), reclaims items stuck in `publishing`
  >10 min, auto-retries transient failures up to 3× (`content_items.retry_count`), batch of 10/run.
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
- `app/accounts/[id]/google/page.js` — Google tab (agency-only): GA4 connection status + per-client
  Meta↔GA4 reconciliation (moved here from the global Reconciliation page, whose route still works for
  deep links but is out of the nav) + Google Ads placeholder until the developer token is approved.
- `app/accounts/[id]/content/page.js` — Content (Posts composer + Calendar). `?edit=<id>` opens composer in edit mode.
- `app/accounts/[id]/engage/page.js` — Listen & Create (Brand Listener + Repurpose Studio).
- Routing is **client-centric**: route param = client_id; a brand shows if it has an ad account OR a social connection.
- Components: ContentManager (composer+list), ContentCalendar (drag-reschedule, right-click-create, quick-edit modal),
  ContentBoard, EngageBoard, BrandListener, RepurposeStudio, RulesManager, AdsManager, CampaignStudio, Shell, AccountTabs,
  NotificationsFeed, TeamManager, OnboardClient. Media utils in `lib/media.js` (crop/upload-progress/video-validate).

## Pending backlog (in priority order chosen by Brooks)
0. **Mobile app (future project — after the web hub is done)** — manual-publish workflow for
   music-critical IG reels: download the post's media, copy caption to clipboard, deep-link into the
   IG app to add licensed music ("notification publishing" — the API cannot attach IG catalog music).
   Plus push notifications when a post passes its scheduled date without approval.
1. **Smart Insights for non-GA4 clients** — generate-insights only iterates clients present in
   ga4_product_monthly (currently Slavens only), so every other brand has an empty Smart Insights tab and no
   insight notifications. Build a daily_metrics-based signal path (campaign-level WoW/MoM trends) for clients
   without GA4. (NEXT)
2. **Fill in business_desc for every brand** (Brooks, in Listen & Create → brand kit) — until set, AI features
   use a generic "ecommerce brand" framing.
Also requested (not yet scheduled):
- Repurpose Studio rework (fix brand-kit fit / black-bars, matching buttons; possible Canva integration later).
- Dropbox integration (browse + pin a default folder per brand to grab photos).
- Interactive crop (drag-to-position live preview) — current crop is center-crop only.
- Social insights tab (pin/enter starting stats + date, track over selectable periods).
- Push/email alerts for approvals + missed schedules (currently in-app notifications only).
- Full top-nav conversion (OneUp-style) — layout is widened but nav still left-rail.

## Recently shipped (2026-07-15, assistant curation powers)
- **Assistant can now see and (with confirmation) delete posts.** Runner v3 tools: list_posts
  (read-only) and propose_deletions — proposals are stored on the task (`account_tasks.proposal`
  jsonb) and NEVER execute directly. The Assistant page renders a card: Confirm delete / Reject;
  confirmed = soft delete (`content_items.deleted_at`), with an ↩ Undo button (30-day window,
  pg_cron `purge-soft-deleted` hard-deletes older rows daily). All content reads + the publisher
  filter `deleted_at is null`; manual Delete buttons also soft-delete now. Storage cost ≈ nothing
  (flag column; media in the bucket is untouched).
- Verified in prod: agency task on FunnelWeb correctly listed the 3 ANEC drafts and filed a pending
  3-post proposal in 22s (background trigger), deleting nothing.

## Recently shipped (2026-07-15, big fix/feature batch)
- **CRITICAL jsonb fix** — postgres.js infers param types from `::jsonb` casts, so every
  `${JSON.stringify(x)}::jsonb` write stored a jsonb STRING (and `||` merges built arrays). Broke:
  composer edit (variants "{}" → phantom customize mode hiding captions), brand-settings saves
  (dropbox_folder/business_desc unreadable). Fixed with `sql.json()` everywhere + data repairs
  (FunnelWeb brand_settings rebuilt with its dropbox folder). RULE: never JSON.stringify into jsonb —
  use sql.json().
- **Assistant v2** — instant start: /api/tasks calls account-task directly with {background:true}
  (202 + EdgeRuntime.waitUntil; the old pg_net trigger from Vercel never fired — tasks waited for the
  */10 cron). Honest results: always appends "Actually created: N drafts, M reminders" + flags failed
  tool calls. Assistant pages auto-refresh every 5s while a task runs. **Agency-level assistant** at
  /assistant (nav): client_id-null tasks get the brand roster and file drafts/reminders per brand via
  a for_client tool param.
- **Image editor** (components/ImageEditor.js) — replaces the composer crop dropdown: ✎ on any thumbnail
  → live canvas preview, drag-to-reframe + zoom, ratio presets, crop-to-fill vs fit+background
  (blur/color), 6 filters, brand-logo watermark (brand kit logo_url) with corner choice; exports 1080px
  JPEG to content-media. Candidate to replace Repurpose Studio's canvas compositor later.
- **Composer**: drag & drop image upload; Dropbox picker default-folder now updates in-session too.
- **Calendars**: item quick-modal gained Delete; agency calendar day-click opens a bulk sheet
  (select all on that day → Approve / Move to date / Delete).
- **Repurpose**: caption model output parsed across ALL text blocks (single-block parse silently
  returned zero variants — looked like "generate not working" and "@/# stripped"); empty results now
  error loudly; "Open the new draft in the composer →" link after drafting.
- **Listener media**: mention_items gains media_urls[] + media_kind; brand-listen v13 pulls carousel
  children and keeps playable video URLs; BrandListener renders carousel strips + <video> for reels.

## Recently shipped (2026-07-15, global Settings + Dropbox thumbnails)
- **Global /settings page** (agency-only; replaces "Team & access" in the nav, /team still routes):
  Connections (FB Pages count, Google/GA4, Dropbox with connect/reconnect), Platform credentials
  checklist (booleans from the new config-status edge fn — values never leave Supabase/Vercel; self-serve
  key editor deferred to the multi-tenant version), Team & access embedded.
- **Dropbox picker v2** — thumbnail grid (files/get_thumbnail_batch, ≤100 per folder, data URIs),
  folder chips, "Set as default" saves brand_settings.dropbox_folder from inside the picker
  (brand-settings API now supports `merge` — mergeBrandSettings jsonb ||). Business team space browsed
  via Dropbox-API-Path-Root (auto-detected, cached on the token row). Onboard page gained a Dropbox panel.

## Recently shipped (2026-07-14, Dropbox + bulk + crash fix)
- **Dropbox** — agency-wide connection (oauth-dropbox edge fn; oauth_tokens provider 'dropbox';
  secrets DROPBOX_APP_KEY/SECRET + Vercel env DROPBOX_APP_KEY). Composer gains "Add from Dropbox":
  browse → import copies files into content-media (temp links expire, so never stored directly).
  Per-brand default folder in Settings (`brand_settings.dropbox_folder`). Setup: create a scoped
  Dropbox app (files.metadata.read + files.content.read), redirect URI
  `https://<domain>/api/oauth/dropbox/callback`, connect from any brand's Settings.
- **Bulk select** on the content list — select all / per-row checkboxes → Submit / Approve / Delete.
- **Crash fix** — "Open in composer" from a brand calendar 500'd (`contentForClient` lacked client_id →
  /accounts/undefined/...); also accountById now returns null on malformed ids (404 instead of 500).

## Recently shipped (2026-07-14, calendar notes + modal)
- **Day-action modal** — left-click (or right-click) any day on an account's content calendar →
  "Create post / Add note" chooser. Notes are `account_tasks` reminders with `created_by` (stamped
  server-side from the session) and `assigned_to` (picked from app_users); shown as amber 📝 chips on
  the calendar (account + agency views), click for detail with Mark done / Delete. Notes surface in
  Notifications when due (existing reminders bucket).
- **Assistant tab restyle** — modern input + gradient Run button; day modal styled per Brooks's mock.

## Recently shipped (2026-07-14, account assistant)
- **Account Assistant tab** (agency-only) — free-text AI tasks per brand. New `account-task` edge fn runs
  Claude with server-side web_search + hub tools (create_draft → draft content_items on the calendar,
  add_reminder → dated reminders). Human approval flow remains the gate; assistant never publishes.
  Queue in `account_tasks` (kind 'task'), fired instantly via pg_net from /api/tasks with a */10 cron
  sweep as fallback. Results + failures surface in agency Notifications (ack to dismiss).
- **Reminders** — `account_tasks` kind 'reminder' (manual or assistant-created); surface in Notifications
  from 1 day before due; "Done" dismisses.
- **Brand tags** — `clients.tags text[]`, edited in Settings, shown as pills on the accounts list.

## Recently shipped (2026-07-14, multi-identity + settings)
- **Multiple Pages per brand** — social_accounts is now one-to-many per client (e.g. Bent Rim Grill +
  Frio Canyon Motorcycle Stop). Composer "Post to" lists every identity's FB/IG as separate options;
  saving groups selections into one content_item per identity (`content_items.social_account_id`,
  FK `on delete set null`); publisher (content-publish v7 logic) posts via the item's own identity with
  fallback to the client's first. Content list shows an identity badge when a brand has >1.
- **Account Settings tab** (agency-only) — rename brand, business_desc, social identities list with
  disconnect, GA4 connect/disconnect, Meta ad account + budget-cap edit. Connect buttons → /onboard.
- **Onboarding UX** — client dropdown now "Assign to client… / ➕ Create new client…" (was a confusing
  "New client…" default); page-picker in the composer got a close button.
- **Data fixes (prod)**: merged duplicate "EPM Performance" clients (GA4 + ads now one client).

## Recently shipped (2026-07-14, Google OAuth)
- **Google OAuth onboarding** — /onboard now has "Continue with Google": OAuth (offline, consent) →
  oauth-google edge fn stores refresh token → pick GA4 properties → ga4_properties rows with
  auth_kind='oauth'. ga4-ingest v8 authenticates per property (SA or OAuth); Slavens SA path verified live.
  Blocked on Brooks: Google Cloud OAuth client + Supabase secrets (see setup section above).

## Recently shipped (2026-07-14, later batch)
- **Actionable account chat** — chat proposes changes as a card (pause/resume, budget w/ cap, create-paused
  campaign, URL params) → Confirm & apply button → /api/manage (audit-logged) or /api/account-settings.
  get_chat_context now includes campaign_id so proposals target real campaigns.
- **Cross-brand AI contamination fix** — "dirt-bike retailer" was hardcoded in account-chat/campaign-plan/
  generate-insights prompts (why Green Chile got Slavens-flavored plans). Now per-brand via
  brand_settings.business_desc; new field in the brand kit UI; Slavens seeded.
- **Quick analytics upgrades** — windows end at the last complete ingest day (no taper from today's partial
  data; `lastFullDataDate()`); ranges >30d chart weekly; dashed revenue trend line; ✨ AI summary button
  (analytics-summary edge fn, Haiku).
- **Brand rename** — ✎ on the Accounts list rows (agency-only API in /api/account-settings; safe because all
  data joins by client_id).

## Recently shipped (2026-07-14)
- **Agency Overview redesign** — per-account 7d trend cards (sparkline + green/red deltas vs prior 7d,
  spend arrow neutral); click opens quick-analytics modal (KPIs + % change vs preceding equal window,
  7/14/30/90d presets + custom dates) via new `/api/analytics` (creator/client-blocked in middleware).
- **content-publish v6 reliability batch** (see edge-function notes above) + `retry_count` migration;
  posts stuck in `publishing` >20 min now surface in Agency Overview notifications.
- **Local verification recipe** — `.claude/skills/verify/SKILL.md`: SSL-enabled Docker Postgres with
  seeded schema + Playwright drive (lib/db.js requires SSL even locally).

## Gotchas
- Git-in-Dropbox caused lock collisions → repo moved to Desktop. If `.git/*.lock` sticks, `rm -f .git/*.lock`.
- postgres.js on the pooler: cast arrays/json (see Data layer).
- Edge function source is not in the repo — download from Supabase to edit locally.
