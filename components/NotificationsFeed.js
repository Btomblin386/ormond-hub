"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

function isVideoUrl(u) {
  if (!u) return false;
  try { return /\.(mp4|mov|m4v|webm|avi|mkv)$/i.test(new URL(u).pathname); }
  catch { return /\.(mp4|mov|m4v|webm|avi|mkv)(\?|$)/i.test(u); }
}
// Thumbnail for a content notification that links straight to the post in the
// composer (edit mode) — so you can recognize and open it, not just approve blind.
function NotifThumb({ item }) {
  const u = item.cover_url || item.media_urls?.[0];
  if (!u || !item.client_id) return null;
  const href = `/accounts/${item.client_id}/content?edit=${item.id}`;
  return (
    <Link href={href} className="notif-thumb" title="Open this post">
      {item.cover_url || !isVideoUrl(u)
        ? <img src={item.cover_url || u} alt="" />
        : <video src={u} muted playsInline preload="metadata" />}
    </Link>
  );
}

export default function NotificationsFeed({ data }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const { spendDrops = [], todos = [], failed = [], ruleEvents = [], insights = [], overdue = [], stuck = [], reminders = [], taskResults = [] } = data || {};
  const total = spendDrops.length + todos.length + failed.length + ruleEvents.length + insights.length + overdue.length + stuck.length + reminders.length + taskResults.length;

  async function dismiss(key) {
    setBusy(key);
    try {
      await fetch("/api/notifications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "dismiss", key }) });
      router.refresh();
    } finally { setBusy(""); }
  }
  const X = ({ k }) => <button className="notif-x" title="Dismiss" disabled={busy === k} onClick={() => dismiss(k)}>×</button>;

  async function approve(id) {
    setBusy(id);
    try {
      await fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "status", id, status: "approved", approvedBy: "agency" }) });
      router.refresh();
    } finally { setBusy(""); }
  }
  async function ackRule(id) {
    setBusy(id);
    try {
      await fetch("/api/rules", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "ack", id }) });
      router.refresh();
    } finally { setBusy(""); }
  }
  async function taskOp(id, op) {
    setBusy(id);
    try {
      await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op, id }) });
      router.refresh();
    } finally { setBusy(""); }
  }

  if (total === 0) return <div className="muted" style={{ fontSize: 13 }}>All clear — nothing needs your attention.</div>;

  return (
    <div className="notif-list">
      {spendDrops.map((s) => (
        <div key={s._key} className="notif fail">
          <span className="notif-dot fail" />
          <div className="notif-body">
            <div className="notif-title">💳 Ad spend dropped to near $0 · <Link href={`/accounts/${s.account_id}`}>{s.client}</Link></div>
            <div className="notif-sub">Was averaging ${s.base_daily}/day, but only ${s.recent2} in the last 2 days (through {s.as_of}). Check the account&apos;s payment method or whether Meta paused it for billing.</div>
          </div>
          <X k={s._key} />
        </div>
      ))}
      {reminders.map((t) => (
        <div key={"rm" + t.id} className="notif todo">
          <span className="notif-dot approval" />
          <div className="notif-body">
            <div className="notif-title">⏰ Reminder · <b>{t.client}</b> <span className="notif-when">{new Date(t.due_at).toLocaleString()}</span></div>
            <div className="notif-sub">{t.title}</div>
          </div>
          <button className="rule-ack" disabled={busy === t.id} onClick={() => taskOp(t.id, "dismiss")}>Done</button>
        </div>
      ))}
      {taskResults.map((t) => (
        <div key={"tk" + t.id} className={"notif " + (t.status === "failed" ? "fail" : "insight")}>
          <span className={"notif-dot " + (t.status === "failed" ? "fail" : "opportunity")} />
          <div className="notif-body">
            <div className="notif-title">🤖 Assistant {t.status === "failed" ? "task failed" : "finished a task"} · <Link href={`/accounts/${t.client_id}/assistant`}>{t.client}</Link></div>
            <div className="notif-sub">{t.status === "failed" ? (t.error || t.title) : (t.result?.slice(0, 160) || t.title)}</div>
          </div>
          <button className="rule-ack" disabled={busy === t.id} onClick={() => taskOp(t.id, "ack")}>Dismiss</button>
        </div>
      ))}
      {overdue.map((t) => (
        <div key={"od" + t.id} className="notif overdue">
          <span className="notif-dot overdue" />
          <NotifThumb item={t} />
          <div className="notif-body">
            <div className="notif-title">⚠ Missed schedule · <b>{t.client}</b> <span className="notif-when">was due {new Date(t.scheduled_at).toLocaleString()}</span></div>
            <div className="notif-sub">{t.status === "needs_approval" ? "Waiting on approval — " : "Still a draft — "}{t.caption?.slice(0, 80) || "(no caption)"}</div>
          </div>
          <Link className="notif-open" href={`/accounts/${t.client_id}/content?edit=${t.id}`}>Open</Link>
          <button className="cal-approve" disabled={busy === t.id} onClick={() => approve(t.id)}>Approve now</button>
          <X k={t._key} />
        </div>
      ))}
      {todos.map((t) => (
        <div key={t.id} className="notif todo">
          <span className="notif-dot approval" />
          <NotifThumb item={t} />
          <div className="notif-body">
            <div className="notif-title">Content needs approval · <b>{t.client}</b></div>
            <div className="notif-sub">{t.caption?.slice(0, 90) || "(no caption)"}</div>
          </div>
          <Link className="notif-open" href={`/accounts/${t.client_id}/content?edit=${t.id}`}>Open</Link>
          <button className="cal-approve" disabled={busy === t.id} onClick={() => approve(t.id)}>Approve</button>
        </div>
      ))}
      {stuck.map((t) => (
        <div key={"st" + t.id} className="notif fail">
          <span className="notif-dot fail" />
          <div className="notif-body">
            <div className="notif-title">Post stuck publishing · <b>{t.client}</b> <span className="notif-when">since {new Date(t.created_at).toLocaleString()}</span></div>
            <div className="notif-sub">Publisher hasn&apos;t completed this post — check the function logs if it persists. {t.caption?.slice(0, 70) || ""}</div>
          </div>
          <X k={t._key} />
        </div>
      ))}
      {failed.map((t) => (
        <div key={t.id} className="notif fail">
          <span className="notif-dot fail" />
          <div className="notif-body">
            <div className="notif-title">Post failed · <b>{t.client}</b> <span className={"err-flag inline " + (t.error_kind || "permanent")}>{t.error_kind === "transient" ? "retry shortly" : "needs a fix"}</span></div>
            <div className="notif-sub">{t.error}</div>
          </div>
          <X k={t._key} />
        </div>
      ))}
      {ruleEvents.map((e) => (
        <div key={e.id} className="notif rule">
          <span className={"notif-dot " + (e.action_taken === "paused" ? "paused" : "flag")} />
          <div className="notif-body">
            <div className="notif-title">Rule {e.action_taken === "paused" ? "auto-paused a campaign" : "flagged a campaign"} · <Link href={`/accounts/${e.account_id}`}>{e.client}</Link></div>
            <div className="notif-sub">{e.message}</div>
          </div>
          <button className="rule-ack" disabled={busy === e.id} onClick={() => ackRule(e.id)}>Dismiss</button>
        </div>
      ))}
      {insights.map((n, i) => (
        <div key={"i" + i} className="notif insight">
          <span className={"notif-dot " + n.category} />
          <div className="notif-body">
            <div className="notif-title">{n.category === "issue" ? "Issue" : "Opportunity"} · <b>{n.client}</b></div>
            <div className="notif-sub">{n.title}</div>
          </div>
          <X k={n._key} />
        </div>
      ))}
    </div>
  );
}
