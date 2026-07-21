import { NextResponse } from "next/server";
import { createContent, updateContent, setContentStatus, deleteContent, rescheduleContent, setContentRevisions, patchContent, retryChannel } from "../../../lib/db";

export const dynamic = "force-dynamic";

const STATUSES = ["draft", "needs_approval", "needs_revisions", "approved", "scheduled", "published", "failed"];

const PUBLISH_FN = "https://jxlrnuyfracyygiksqdj.supabase.co/functions/v1/content-publish";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4bHJudXlmcmFjeXlnaWtzcWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjQ1OTUsImV4cCI6MjA5MDIwMDU5NX0.std1mTdOV4bU4S7wygQ67NdganwPrI6b2HFBi1BXQJ8";

// Fire the publisher immediately (Post Now) instead of waiting for the */15 cron.
// Best-effort: the cron still catches anything this misses.
async function kickPublisher() {
  try { await fetch(PUBLISH_FN, { method: "POST", headers: { Authorization: `Bearer ${ANON}` }, body: "{}" }); } catch { /* cron backs it up */ }
}

export async function POST(req) {
  try {
    const b = await req.json();
    const op = b.op;

    if (op === "create") {
      if (!b.clientId) return NextResponse.json({ error: "missing clientId" }, { status: 400 });
      if (!Array.isArray(b.channels) || b.channels.length === 0) return NextResponse.json({ error: "pick a channel" }, { status: 400 });
      const [row] = await createContent(b);
      if (b.publishNow) await kickPublisher();
      return NextResponse.json({ ok: true, id: row.id });
    }
    if (op === "update") {
      await updateContent(b.id, b);
      return NextResponse.json({ ok: true });
    }
    if (op === "status") {
      if (!STATUSES.includes(b.status)) return NextResponse.json({ error: "bad status" }, { status: 400 });
      await setContentStatus(b.id, b.status, b.approvedBy);
      if (b.publishNow) await kickPublisher();
      return NextResponse.json({ ok: true });
    }
    if (op === "retry_channel") {
      if (!["facebook", "instagram", "tiktok"].includes(b.channel)) return NextResponse.json({ error: "bad channel" }, { status: 400 });
      await retryChannel(b.id, b.channel);
      await kickPublisher();
      return NextResponse.json({ ok: true });
    }
    if (op === "reschedule") {
      await rescheduleContent(b.id, b.scheduledAt ? new Date(b.scheduledAt).toISOString() : null);
      return NextResponse.json({ ok: true });
    }
    if (op === "revisions") {
      await setContentRevisions(b.id, b.note || null);
      return NextResponse.json({ ok: true });
    }
    if (op === "patch") {
      await patchContent(b.id, { caption: b.caption, note: b.note });
      return NextResponse.json({ ok: true });
    }
    if (op === "delete") {
      await deleteContent(b.id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "unknown op" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
