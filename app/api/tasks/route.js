import { NextResponse } from "next/server";
import { createTask, setTaskStatus, deleteTask, getTask, setTaskProposal, softDeletePosts, restorePosts } from "../../../lib/db";
import { getSession } from "../../../lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const FN_URL = "https://jxlrnuyfracyygiksqdj.supabase.co/functions/v1/account-task";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4bHJudXlmcmFjeXlnaWtzcWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjQ1OTUsImV4cCI6MjA5MDIwMDU5NX0.std1mTdOV4bU4S7wygQ67NdganwPrI6b2HFBi1BXQJ8";

// Kick the runner directly: it responds 202 immediately and processes in the
// background (EdgeRuntime.waitUntil), so tasks start within seconds. The
// */10 cron sweep remains the safety net.
async function trigger(taskId) {
  try {
    await fetch(FN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}` },
      body: JSON.stringify({ task_id: taskId, background: true }),
    });
  } catch { /* cron picks it up */ }
}

export async function POST(req) {
  try {
    const b = await req.json();
    const op = b.op;

    if (op === "create") {
      if (!b.title?.trim()) return NextResponse.json({ error: "missing title" }, { status: 400 });
      const kind = b.kind === "reminder" ? "reminder" : "task";
      if (kind === "reminder" && (!b.clientId || !b.dueAt)) return NextResponse.json({ error: "reminders need a brand and a date" }, { status: 400 });
      const createdBy = getSession()?.name || "Agency";
      const [row] = await createTask({ clientId: b.clientId || null, kind, title: b.title.trim(), instructions: b.instructions?.trim() || null, dueAt: b.dueAt || null, createdBy, assignedTo: b.assignedTo?.trim() || null });
      if (kind === "task") await trigger(row.id);
      return NextResponse.json({ ok: true, id: row.id });
    }
    if (op === "run") {
      await setTaskStatus(b.id, { status: "queued" });
      await trigger(b.id);
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

    // ---- assistant deletion proposals: confirm / reject / undo ----
    if (op === "confirm_action" || op === "reject_action" || op === "undo_action") {
      const task = await getTask(b.id);
      const p = task?.proposal;
      if (!p || p.action !== "delete_posts") return NextResponse.json({ error: "no proposal on this task" }, { status: 400 });
      const by = getSession()?.name || "Agency";

      if (op === "reject_action") {
        if (p.state !== "pending") return NextResponse.json({ error: "proposal is not pending" }, { status: 400 });
        await setTaskProposal(b.id, { ...p, state: "rejected", decided_by: by, decided_at: new Date().toISOString() });
        return NextResponse.json({ ok: true });
      }
      if (op === "confirm_action") {
        if (p.state !== "pending") return NextResponse.json({ error: "proposal is not pending" }, { status: 400 });
        const rows = await softDeletePosts(p.ids || []);
        await setTaskProposal(b.id, { ...p, state: "confirmed", deleted: rows.length, decided_by: by, decided_at: new Date().toISOString() });
        return NextResponse.json({ ok: true, deleted: rows.length });
      }
      // undo
      if (p.state !== "confirmed") return NextResponse.json({ error: "nothing to undo" }, { status: 400 });
      const rows = await restorePosts(p.ids || []);
      await setTaskProposal(b.id, { ...p, state: "undone", restored: rows.length, undone_at: new Date().toISOString() });
      return NextResponse.json({ ok: true, restored: rows.length });
    }
    return NextResponse.json({ error: "unknown op" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
