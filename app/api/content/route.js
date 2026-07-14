import { NextResponse } from "next/server";
import { createContent, updateContent, setContentStatus, deleteContent, rescheduleContent } from "../../../lib/db";

export const dynamic = "force-dynamic";

const STATUSES = ["draft", "needs_approval", "approved", "scheduled", "published", "failed"];

export async function POST(req) {
  try {
    const b = await req.json();
    const op = b.op;

    if (op === "create") {
      if (!b.clientId) return NextResponse.json({ error: "missing clientId" }, { status: 400 });
      if (!Array.isArray(b.channels) || b.channels.length === 0) return NextResponse.json({ error: "pick a channel" }, { status: 400 });
      const [row] = await createContent(b);
      return NextResponse.json({ ok: true, id: row.id });
    }
    if (op === "update") {
      await updateContent(b.id, b);
      return NextResponse.json({ ok: true });
    }
    if (op === "status") {
      if (!STATUSES.includes(b.status)) return NextResponse.json({ error: "bad status" }, { status: 400 });
      await setContentStatus(b.id, b.status, b.approvedBy);
      return NextResponse.json({ ok: true });
    }
    if (op === "reschedule") {
      await rescheduleContent(b.id, b.scheduledAt ? new Date(b.scheduledAt).toISOString() : null);
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
