import { NextResponse } from "next/server";
import { getSession } from "../../../lib/session";
import { createAlertRule, updateAlertRule, setAlertRuleEnabled, deleteAlertRule } from "../../../lib/db";

export const dynamic = "force-dynamic";

const ALERTS_FN = "https://jxlrnuyfracyygiksqdj.supabase.co/functions/v1/content-alerts";
const EMAIL_FN = "https://jxlrnuyfracyygiksqdj.supabase.co/functions/v1/send-email";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4bHJudXlmcmFjeXlnaWtzcWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjQ1OTUsImV4cCI6MjA5MDIwMDU5NX0.std1mTdOV4bU4S7wygQ67NdganwPrI6b2HFBi1BXQJ8";

const parseEmails = (s) => String(s || "").split(/[,;\s]+/).map((e) => e.trim()).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));

function ruleFrom(b) {
  const emails = Array.isArray(b.emails) ? b.emails : parseEmails(b.emails);
  const leadMinutes = Math.max(5, Math.min(4320, parseInt(b.leadMinutes, 10) || 30));
  const kind = ["unapproved_post", "publish_failed"].includes(b.kind) ? b.kind : "unapproved_post";
  return { kind, clientIds: Array.isArray(b.clientIds) ? b.clientIds.filter(Boolean) : [], emails, leadMinutes, enabled: b.enabled !== false };
}

export async function POST(req) {
  const s = getSession();
  if (s?.role !== "agency") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const b = await req.json();

    if (b.op === "create" || b.op === "update") {
      const d = ruleFrom(b);
      if (!d.emails.length) return NextResponse.json({ error: "Add at least one valid email address." }, { status: 400 });
      if (b.op === "create") { const [row] = await createAlertRule(d); return NextResponse.json({ ok: true, id: row.id }); }
      if (!b.id) return NextResponse.json({ error: "missing id" }, { status: 400 });
      await updateAlertRule(b.id, d);
      return NextResponse.json({ ok: true });
    }
    if (b.op === "toggle") {
      await setAlertRuleEnabled(b.id, b.enabled);
      return NextResponse.json({ ok: true });
    }
    if (b.op === "delete") {
      await deleteAlertRule(b.id);
      return NextResponse.json({ ok: true });
    }
    if (b.op === "run") {
      // Manual "Run check now" — same scan the 5-min cron fires.
      const r = await fetch(ALERTS_FN, { method: "POST", headers: { Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: "{}" });
      const d = await r.json();
      return NextResponse.json(d, { status: r.status });
    }
    if (b.op === "test") {
      const to = parseEmails(b.emails);
      if (!to.length) return NextResponse.json({ error: "Add at least one valid email address first." }, { status: 400 });
      const r = await fetch(EMAIL_FN, {
        method: "POST", headers: { Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "alert", to, fromName: "Ormond Hub Alerts", subject: "Test alert — Ormond Hub Notifications",
          html: `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;color:#111827;max-width:520px"><h2 style="margin:0 0 8px;font-size:17px">This is a test alert ✓</h2><div>Email alerts from the Ormond Hub Notifications page are reaching this address. Real alerts will include the post, its schedule, and a one-click Approve button.</div></div>`,
        }),
      });
      const d = await r.json();
      return NextResponse.json(d, { status: r.status });
    }
    return NextResponse.json({ error: "unknown op" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
