import { NextResponse } from "next/server";
import { setLeadStatus, mergeBrandSettings } from "../../../lib/db";

export const dynamic = "force-dynamic";

const INGEST_FN = "https://jxlrnuyfracyygiksqdj.supabase.co/functions/v1/lead-ingest";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4bHJudXlmcmFjeXlnaWtzcWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjQ1OTUsImV4cCI6MjA5MDIwMDU5NX0.std1mTdOV4bU4S7wygQ67NdganwPrI6b2HFBi1BXQJ8";

export async function POST(req) {
  try {
    const b = await req.json();

    if (b.op === "set_emails") {
      if (!b.clientId) return NextResponse.json({ error: "missing clientId" }, { status: 400 });
      const emails = String(b.emails || "")
        .split(/[,;\s]+/)
        .map((e) => e.trim())
        .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
      await mergeBrandSettings(b.clientId, { lead_emails: emails });
      return NextResponse.json({ ok: true, emails });
    }
    if (b.op === "mark") {
      if (!b.id || !["new", "contacted", "emailed"].includes(b.status)) return NextResponse.json({ error: "bad args" }, { status: 400 });
      await setLeadStatus(b.id, b.status);
      return NextResponse.json({ ok: true });
    }
    if (b.op === "email_lead") {
      if (!b.id) return NextResponse.json({ error: "missing id" }, { status: 400 });
      const r = await fetch(INGEST_FN, { method: "POST", headers: { Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: JSON.stringify({ action: "email_lead", lead_id: b.id }) });
      const d = await r.json();
      return NextResponse.json(d, { status: r.status });
    }
    if (b.op === "sync") {
      // On-demand pull (the cron also runs every 10 min)
      const r = await fetch(INGEST_FN, { method: "POST", headers: { Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" }, body: "{}" });
      const d = await r.json();
      return NextResponse.json(d, { status: r.status });
    }
    return NextResponse.json({ error: "unknown op" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
