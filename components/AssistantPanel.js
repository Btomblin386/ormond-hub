"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const STATUS_CHIP = { queued: "Queued", running: "Running…", done: "Done", failed: "Failed", pending: "Pending" };

async function post(body) {
  const r = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}

export default function AssistantPanel({ clientId, client, tasks }) {
  const router = useRouter();
  const [instructions, setInstructions] = useState("");
  const [remTitle, setRemTitle] = useState("");
  const [remDate, setRemDate] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  function flash(t) { setMsg(t); setTimeout(() => setMsg(""), 8000); }

  const aiTasks = tasks.filter((t) => t.kind === "task");
  const reminders = tasks.filter((t) => t.kind === "reminder" && t.status === "pending");

  async function runTask() {
    const text = instructions.trim();
    if (!text) return;
    setBusy("task");
    try {
      const d = await post({ op: "create", clientId, kind: "task", title: text.slice(0, 120), instructions: text });
      if (d.error) flash("Error: " + d.error);
      else { setInstructions(""); flash("Task queued — the assistant is on it. Results land here and in Notifications (usually 1–2 minutes)."); router.refresh(); }
    } finally { setBusy(""); }
  }
  async function addReminder() {
    if (!remTitle.trim() || !remDate) { flash("A reminder needs a title and a date."); return; }
    setBusy("rem");
    try {
      const d = await post({ op: "create", clientId, kind: "reminder", title: remTitle.trim(), dueAt: new Date(remDate).toISOString() });
      if (d.error) flash("Error: " + d.error);
      else { setRemTitle(""); setRemDate(""); router.refresh(); }
    } finally { setBusy(""); }
  }
  async function act(id, op) {
    setBusy(id + op);
    try { await post({ op, id }); router.refresh(); } finally { setBusy(""); }
  }

  return (
    <>
      {msg && <div className="mng-msg">{msg}</div>}

      <div className="panel">
        <h2>Give the assistant a task</h2>
        <p className="note">It researches the web and works inside the hub for {client} — drafting posts onto the calendar (never publishing), setting reminders. Try:
          &nbsp;<i>&quot;Locate the national enduro schedule and draft fantasy-league posts two days before each round.&quot;</i></p>
        <textarea rows={3} className="assist-input" value={instructions} onChange={(e) => setInstructions(e.target.value)}
          placeholder="Describe the job — it can look things up online and create dated drafts and reminders…" />
        <button className="assist-run" onClick={runTask} disabled={busy === "task" || !instructions.trim()}>
          {busy === "task" ? "Queuing…" : "✨ Run task"}
        </button>

        {aiTasks.length > 0 && (
          <div className="task-list">
            {aiTasks.map((t) => (
              <div key={t.id} className="task-row">
                <div className="task-head">
                  <span className={"cbadge " + (t.status === "done" ? "published" : t.status === "failed" ? "failed" : t.status === "running" ? "publishing" : "draft")}>{STATUS_CHIP[t.status] || t.status}</span>
                  <span className="task-title">{t.title}</span>
                  <span className="content-when">{new Date(t.completed_at || t.created_at).toLocaleString()}</span>
                </div>
                {t.result && <div className="task-result">{t.result}</div>}
                {t.error && <div className="push-err">{t.error}</div>}
                <div className="task-actions">
                  {t.status === "done" && <Link href={`/accounts/${clientId}/content`} className="rowlink">View drafts →</Link>}
                  {t.status === "failed" && <button className="social-btn" disabled={busy === t.id + "run"} onClick={() => act(t.id, "run")}>Retry</button>}
                  <button className="rule-del" disabled={busy === t.id + "delete"} onClick={() => act(t.id, "delete")}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <h2>Reminders</h2>
        <p className="note">Dated notes about this brand — they surface in agency Notifications when due. The assistant can also set these for you.</p>
        <div className="set-row">
          <input type="text" value={remTitle} onChange={(e) => setRemTitle(e.target.value)} placeholder="e.g. Post fantasy-league picks link" style={{ flex: 2 }} />
          <input type="datetime-local" value={remDate} onChange={(e) => setRemDate(e.target.value)} style={{ flex: 1, minWidth: 190, border: "1px solid #d1d5db", borderRadius: 8, padding: "7px 10px", font: "inherit", fontSize: 13 }} />
          <button className="social-btn" onClick={addReminder} disabled={busy === "rem"}>Add</button>
        </div>
        {reminders.length === 0
          ? <div className="muted" style={{ fontSize: 13 }}>No upcoming reminders.</div>
          : reminders.map((t) => (
            <div key={t.id} className="set-conn">
              <span>⏰</span>
              <span className="set-conn-name">{t.title}</span>
              <span className="muted" style={{ fontSize: 12 }}>{t.due_at ? new Date(t.due_at).toLocaleString() : ""}</span>
              <button className="rule-del" disabled={busy === t.id + "dismiss"} onClick={() => act(t.id, "dismiss")}>Done</button>
            </div>
          ))}
      </div>
    </>
  );
}
