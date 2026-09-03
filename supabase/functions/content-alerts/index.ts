import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Content alert engine, driven by the rules on the hub's Notifications page.
//
//  POST {}                → scan: for every enabled rule, find matching posts and
//                           email the rule's recipients via send-email (the hub's
//                           email spine). Deduped one email per (rule, post) via
//                           alert_sends. Runs on a */5 cron; POST requires the
//                           anon bearer (verify_jwt is off for the GET below).
//  GET ?t=<signed token>  → one-click Approve from inside the alert email.
//                           Token = b64url(payload).b64url(HMAC-SHA256(payload,
//                           SERVICE_ROLE_KEY)) — only this function can mint or
//                           verify one. Approves the post, kicks the publisher,
//                           renders a tiny confirmation page.
//
// Rule kinds:
//  unapproved_post — post scheduled within lead_minutes (or up to 48h overdue)
//                    still in draft / needs_approval / needs_revisions.
//  publish_failed  — post entered status 'failed' in the last 48h.

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const J = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const enc = new TextEncoder();
function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function hmacKey(secret: string) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}
async function signToken(payload: object, secret: string): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body)));
  return `${body}.${b64url(mac)}`;
}
async function verifyToken(token: string, secret: string): Promise<any | null> {
  try {
    const [body, sig] = (token || "").split(".");
    if (!body || !sig) return null;
    const mac = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(body)));
    if (b64url(mac) !== sig) return null;
    let b = body.replace(/-/g, "+").replace(/_/g, "/");
    while (b.length % 4) b += "=";
    const p = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b), (c) => c.charCodeAt(0))));
    if (p.exp && Date.now() > p.exp) return null;
    return p;
  } catch { return null; }
}

const CT = "America/Chicago";
const fmtWhen = (iso: string) => new Date(iso).toLocaleString("en-US", { timeZone: CT, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true }) + " CT";
function relWhen(iso: string): string {
  const mins = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (mins >= -2 && mins <= 2) return "right about now";
  const abs = Math.abs(mins);
  const span = abs < 60 ? `${abs} minute${abs === 1 ? "" : "s"}` : abs < 2880 ? `${Math.round(abs / 60)} hour${Math.round(abs / 60) === 1 ? "" : "s"}` : `${Math.round(abs / 1440)} days`;
  return mins > 0 ? `in ${span}` : `${span} ago`;
}
const STATUS_LABEL: Record<string, string> = { draft: "Draft", needs_approval: "Needs approval", needs_revisions: "Needs revisions", failed: "Failed" };
const CHAN: Record<string, string> = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  // The project's anon JWT (public by design — it's in the app bundle and crons).
  // SUPABASE_ANON_KEY env may hold a newer-format key, so scan auth accepts either;
  // internal function-to-function calls send this one because the platform's
  // verify_jwt on those functions is known to accept it.
  const ANON_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4bHJudXlmcmFjeXlnaWtzcWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjQ1OTUsImV4cCI6MjA5MDIwMDU5NX0.std1mTdOV4bU4S7wygQ67NdganwPrI6b2HFBi1BXQJ8";
  const anon = ANON_JWT;
  const fnBase = `${Deno.env.get("SUPABASE_URL")}/functions/v1`;
  const appBase = (Deno.env.get("APP_BASE") || "https://ormond-hub.vercel.app").replace(/\/$/, "");
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, svcKey);

  /* ------- GET: legacy approve links from already-sent emails -------
     *.supabase.co rewrites text/html responses to text/plain (anti-phishing),
     so this domain can't render pages. Old emails linked here directly; hand
     them off to the app's styled page, which calls back via approve_token. */
  if (req.method === "GET") {
    const t = url.searchParams.get("t") || "";
    return new Response(null, { status: 302, headers: { Location: `${appBase}/email-action?t=${encodeURIComponent(t)}` } });
  }

  /* ---------------- POST: cron scan ---------------- */
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const envAnon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!bearer || (bearer !== ANON_JWT && bearer !== envAnon && bearer !== svcKey)) return J({ error: "unauthorized" }, 401);

  let body: any = {};
  try { body = await req.clone().json(); } catch {}

  /* ------- approve_token: one-click approve, called by the app's /email-action page ------- */
  if (body.action === "approve_token") {
    const p = await verifyToken(String(body.t || ""), svcKey);
    if (!p || p.act !== "approve" || !p.id) return J({ result: "expired" });
    const { data: it } = await supabase.from("content_items").select("id, client_id, status, scheduled_at, deleted_at, clients(name)").eq("id", p.id).maybeSingle();
    if (!it || it.deleted_at) return J({ result: "not_found" });
    const client = (it as any).clients?.name || "";
    const reviewUrl = `${appBase}/accounts/${it.client_id}/content?edit=${p.id}#posts`;
    if (["published", "publishing"].includes(it.status)) return J({ result: "already_published", client, publishing: it.status === "publishing", reviewUrl });
    if (["approved", "scheduled"].includes(it.status)) return J({ result: "already_approved", client, when: it.scheduled_at ? relWhen(it.scheduled_at) : null, reviewUrl });
    const overdue = it.scheduled_at && new Date(it.scheduled_at).getTime() < Date.now();
    const { error } = await supabase.from("content_items").update({ status: "approved", approved_by: "email approval", error: null, updated_at: new Date().toISOString(), scheduled_at: overdue || !it.scheduled_at ? new Date(Date.now() + 5 * 60000).toISOString() : it.scheduled_at }).eq("id", p.id);
    if (error) return J({ result: "error", error: error.message });
    // Kick the publisher so an overdue approval goes out within moments.
    try { await fetch(`${fnBase}/content-publish`, { method: "POST", headers: { Authorization: `Bearer ${anon}`, "Content-Type": "application/json" }, body: "{}" }); } catch { /* cron backs it up */ }
    const when = overdue || !it.scheduled_at ? "within the next few minutes" : `${relWhen(it.scheduled_at)} (${fmtWhen(it.scheduled_at)})`;
    return J({ result: "approved", client, when, reviewUrl });
  }

  const { data: rules } = await supabase.from("alert_rules").select("*").eq("enabled", true);
  if (!rules?.length) return J({ ok: true, sent: 0, note: "no enabled rules" });

  const nowMs = Date.now();
  const results: any[] = [];
  let sent = 0;

  for (const rule of rules) {
    const recips = (rule.emails || []).filter((e: string) => e?.includes("@"));
    if (!recips.length) continue;

    let q = supabase.from("content_items")
      .select("id, client_id, channels, caption, cover_url, media_urls, status, post_type, scheduled_at, error, clients(name)")
      .is("deleted_at", null);
    if (rule.client_ids?.length) q = q.in("client_id", rule.client_ids);

    if (rule.kind === "unapproved_post") {
      q = q.in("status", ["draft", "needs_approval", "needs_revisions"])
        .not("scheduled_at", "is", null)
        .lte("scheduled_at", new Date(nowMs + rule.lead_minutes * 60000).toISOString())
        .gte("scheduled_at", new Date(nowMs - 48 * 3600_000).toISOString());
    } else { // publish_failed
      q = q.eq("status", "failed").gte("updated_at", new Date(nowMs - 48 * 3600_000).toISOString());
    }
    const { data: hits, error: qErr } = await q;
    if (qErr) { results.push({ rule: rule.id, error: qErr.message }); continue; }
    if (!hits?.length) continue;

    // Drop posts this rule already emailed about
    const { data: already } = await supabase.from("alert_sends").select("content_id").eq("rule_id", rule.id).in("content_id", hits.map((h: any) => h.id));
    const seen = new Set((already || []).map((a: any) => a.content_id));
    const fresh = hits.filter((h: any) => !seen.has(h.id));

    for (const it of fresh) {
      const client = (it as any).clients?.name || "a client";
      const chans = (it.channels || []).map((c: string) => CHAN[c] || c).join(" + ");
      const capt = (it.caption || "").slice(0, 220);
      const thumb = it.cover_url || (it.media_urls || []).find((u: string) => /\.(jpe?g|png|webp|gif)(\?|$)/i.test(u)) || null;
      const review = `${appBase}/accounts/${it.client_id}/content?edit=${it.id}#posts`;
      const isUnapproved = rule.kind === "unapproved_post";
      const overdue = it.scheduled_at && new Date(it.scheduled_at).getTime() < nowMs;

      let subject: string, headline: string;
      if (isUnapproved) {
        headline = overdue
          ? `A post was scheduled for publishing <b>${esc(relWhen(it.scheduled_at))}</b> and still hasn't been approved.`
          : `A post scheduled for publishing <b>${esc(relWhen(it.scheduled_at))}</b> has not yet been approved.`;
        subject = overdue ? `⏰ Overdue post still needs approval — ${client}` : `⏰ Post publishing ${relWhen(it.scheduled_at)} needs approval — ${client}`;
      } else {
        headline = `A post <b>failed to publish</b>${it.scheduled_at ? ` (was scheduled for ${esc(fmtWhen(it.scheduled_at))})` : ""}.`;
        subject = `⚠️ Post failed to publish — ${client}`;
      }

      const token = isUnapproved ? await signToken({ act: "approve", id: it.id, exp: nowMs + 7 * 86400_000 }, svcKey) : null;
      const approveUrl = token ? `${appBase}/email-action?t=${encodeURIComponent(token)}` : null;

      const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#111827;max-width:560px">
  <h2 style="margin:0 0 6px;font-size:17px">${isUnapproved ? "Post needs approval" : "Post failed to publish"} — ${esc(client)}</h2>
  <div style="margin-bottom:14px">${headline}</div>
  <div style="border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;background:#f9fafb">
    <div style="color:#6b7280;font-size:12.5px;margin-bottom:8px">${esc(chans)}${it.post_type && it.post_type !== "feed" ? " · " + esc(it.post_type) : ""} · ${it.scheduled_at ? esc(fmtWhen(it.scheduled_at)) : "no date"} · ${esc(STATUS_LABEL[it.status] || it.status)}</div>
    ${thumb ? `<img src="${esc(thumb)}" alt="" style="max-width:160px;max-height:160px;border-radius:8px;display:block;margin-bottom:8px">` : ""}
    <div style="white-space:pre-wrap">${esc(capt)}${(it.caption || "").length > 220 ? "…" : ""}</div>
    ${!isUnapproved && it.error ? `<div style="margin-top:8px;color:#b91c1c;font-size:12.5px">${esc(it.error)}</div>` : ""}
  </div>
  <div style="margin:18px 0">
    ${approveUrl ? `<a href="${approveUrl}" style="display:inline-block;background:#16a34a;color:#fff;font-weight:600;padding:10px 22px;border-radius:9px;text-decoration:none">✓ Approve this post</a>&nbsp;&nbsp;` : ""}
    <a href="${review}" style="display:inline-block;border:1px solid #d1d5db;color:#374151;font-weight:600;padding:9px 20px;border-radius:9px;text-decoration:none;background:#fff">${isUnapproved ? "Review in Ormond Hub" : "Open in Ormond Hub"}</a>
  </div>
  <div style="padding-top:12px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:11.5px">You're getting this from an alert rule on the Ormond Hub Notifications page${isUnapproved ? ` (${rule.lead_minutes} min before publish)` : ""}. Adjust or turn it off there.</div>
</div>`;

      // Claim the (rule, post) BEFORE sending: a concurrent scan (cron + manual
      // "Run check now") must not double-email. Unique violation = someone else
      // already claimed it; skip. If the send then fails, release the claim so
      // the next scan retries.
      const { error: claimErr } = await supabase.from("alert_sends").insert({ rule_id: rule.id, content_id: it.id });
      if (claimErr) continue;
      try {
        const r = await fetch(`${fnBase}/send-email`, {
          method: "POST", headers: { Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "alert", clientId: it.client_id, to: recips, fromName: "Ormond Hub Alerts", subject, html }),
        });
        const jr = await r.json();
        if (!jr.ok) throw new Error(jr.error || "send failed");
        sent++;
        results.push({ rule: rule.kind, client, post: it.id, to: recips.length });
      } catch (e) {
        await supabase.from("alert_sends").delete().eq("rule_id", rule.id).eq("content_id", it.id);
        results.push({ rule: rule.kind, post: it.id, error: String((e as Error).message || e) });
      }
    }
  }
  return J({ ok: true, sent, results });
});
