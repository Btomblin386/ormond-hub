# Ormond Hub — Ads Management: Feature Plan

Goal: turn the hub from read + advise into **manage** — creating and controlling Meta campaigns from inside the app, safely. Everything is built on the principle: **nothing spends money without an explicit human approval, and every write is logged and reversible.**

Status today: we can read all metrics, generate insights, chat, and *draft* campaigns (Campaign Studio). Nothing yet writes to Meta. `ads_management` is already granted on your System User, so writes are technically unlocked.

---

## Tier 1 — The draft-and-approve loop (core)

1. **Push draft → Meta (PAUSED).** Take a Campaign Studio draft and create the real campaign + ad set + ad in Meta, always in PAUSED state. Nothing runs until you approve.
2. **Drafts / approvals queue.** A dedicated page listing every draft with status (draft → pushed-paused → live → rejected). Review, edit fields, then act.
3. **Activate / pause toggle.** One click to set a paused campaign live, or pause a running one.
4. **Guardrails.** Hard spend caps (e.g., max daily budget), mandatory confirmation on anything that spends, and everything defaults to PAUSED.
5. **Change log / audit trail.** Every write (create, budget change, activate, pause) recorded with timestamp, so you can see and reverse what happened.

## Tier 2 — Live campaign controls

6. **Budget edits.** Change daily/lifetime budget on an existing campaign or ad set from the dashboard.
7. **Pause / resume existing campaigns & ad sets.** Direct control over what's already running.
8. **Bulk actions.** Apply pause/budget changes across several campaigns or accounts at once.

## Tier 3 — Creative & targeting

9. **Creative upload.** Upload images/video to the ad account (or pick existing) so a drafted ad is complete and launchable.
10. **AI copy variants.** Generate multiple headline/primary-text options per draft (extends Campaign Studio).
11. **Audience builder.** Create/save custom audiences & lookalikes; reuse the account's existing saved audiences; attach them to drafts.

## Tier 4 — Automation & testing

12. **Rules engine.** "If ROAS < X for 3 days → pause," "if ROAS > Y → +20% budget." Two modes: **notify-only** (default, safe) or **auto-apply** (guardrailed, opt-in per rule).
13. **Scheduling / dayparting.** Campaign start/end dates and hour-of-day targeting.
14. **A/B variants.** Draft multiple creative/audience variants and compare results.

## Tier 5 — Later (own phases)

15. **Google Ads parity.** Same controls for Google — needs the Google Ads API developer token (1–4 wk approval).
16. **Client approvals.** Clients approve drafts in their own portal login (needs the client-login phase).

---

## Dependencies & risk notes

- **Meta access:** `ads_management` is granted. Creating PAUSED campaigns and managing accounts owned by / shared into your Business Manager works now, in the app's current state. Publishing on behalf of *unshared* accounts, or high-volume automated actions, may hit Meta App Review — we'll only find the edge if we hit it.
- **Creative:** ads need real creative. Images upload via the account's ad-images endpoint; video via the video endpoint. Tier 1 can launch with an existing image or a product-catalog ad; full creative upload is Tier 3.
- **Money safety (non-negotiable):** paused-by-default, per-account spend caps, explicit confirm on spend, full audit log, and no auto-activation. Auto-apply rules (Tier 4) are opt-in per rule and still capped.
- **Cost:** all still ~$25–45/mo infra + AI usage; no per-account SaaS.

---

## Recommended build order

**Build now: Tier 1 + Tier 2** — the complete draft-and-approve loop plus live controls (budget, pause/resume, bulk, audit log, guardrails). That's the safe, high-value core and makes the hub a real management tool.

**Then Tier 3** (creative + audiences) so drafts are fully launchable without touching Ads Manager.

**Then Tier 4** (rules/automation) once you trust the loop.

Tier 5 is gated on external approvals / other phases.
