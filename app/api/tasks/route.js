import { NextResponse } from "next/server";
import { createTask, setTaskStatus, deleteTask, triggerTaskRunner } from "../../../lib/db";
import { getSession } from "../../../lib/session";

export const dynamic = "force-dynamic";

const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4bHJudXlmcmFjeXlnaWtzcWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjQ1OTUsImV4cCI6MjA5MDIwMDU5NX0.std1mTdOV4bU4S7wygQ67NdganwPrI6b2HFBi1BXQJ8";

// Fire the runner without blocking the response; the cron sweep is the fallback
// (and local dev, which has no pg_net, relies on it entirely).
async function tryTrigger(taskId) {
  try { await triggerTaskRunner(taskId, ANON); } catch { /* cron picks it up */ }
}

export async function POST(req) {
  try {
    const b = await req.json();
    const op = b.op;

    if (op === "create") {
      if (!b.clientId || !b.title?.trim()) return NextResponse.json({ error: "missing clientId/title" }, { status: 400 });
      const kind = b.kind === "reminder" ? "reminder" : "task";
      if (kind === "reminder" && !b.dueAt) return NextResponse.json({ error: "reminders need a date" }, { status: 400 });
      const createdBy = getSession()?.name || "Agency";
      const [row] = await createTask({ clientId: b.clientId, kind, title: b.title.trim(), instructions: b.instructions?.trim() || null, dueAt: b.dueAt || null, createdBy, assignedTo: b.assignedTo?.trim() || null });
      if (kind === "task") await tryTrigger(row.id);
      return NextResponse.json({ ok: true, id: row.id });
    }
    if (op === "run") {
      await setTaskStatus(b.id, { status: "queued" });
      await tryTrigger(b.id);
      return NextResponse.json({ ok: true });
    }
    if (op === "dismiss") {
      await setTaskStatus(b.id, { status: "done", acknowledged: true });
      return NextResponse.json({ ok: true });
    }
    if (op === "ack") {
      await setTaskStatus(b.id, { acknowledged: true });
      return NextResponse.json({ ok: true });
    }
    if (op === "delete") {
      await deleteTask(b.id);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "unknown op" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
