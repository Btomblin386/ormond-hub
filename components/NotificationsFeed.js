"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NotificationsFeed({ data }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const { todos = [], failed = [], ruleEvents = [], insights = [], overdue = [] } = data || {};
  const total = todos.length + failed.length + ruleEvents.length + insights.length + overdue.length;

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

  if (total === 0) return <div className="muted" style={{ fontSize: 13 }}>All clear — nothing needs your attention.</div>;

  return (
    <div className="notif-list">
      {overdue.map((t) => (
        <div key={"od" + t.id} className="notif overdue">
          <span className="notif-dot overdue" />
          <div className="notif-body">
            <div className="notif-title">⚠ Missed schedule · <b>{t.client}</b> <span className="notif-when">was due {new Date(t.scheduled_at).toLocaleString()}</span></div>
            <div className="notif-sub">{t.status === "needs_approval" ? "Waiting on approval — " : "Still a draft — "}{t.caption?.slice(0, 80) || "(no caption)"}</div>
          </div>
          <button className="cal-approve" disabled={busy === t.id} onClick={() => approve(t.id)}>Approve now</button>
        </div>
      ))}
      {todos.map((t) => (
        <div key={t.id} className="notif todo">
          <span className="notif-dot approval" />
          <div className="notif-body">
            <div className="notif-title">Content needs approval · <b>{t.client}</b></div>
            <div className="notif-sub">{t.caption?.slice(0, 90) || "(no caption)"}</div>
          </div>
          <button className="cal-approve" disabled={busy === t.id} onClick={() => approve(t.id)}>Approve</button>
        </div>
      ))}
      {failed.map((t) => (
        <div key={t.id} className="notif fail">
          <span className="notif-dot fail" />
          <div className="notif-body">
            <div className="notif-title">Post failed · <b>{t.client}</b></div>
            <div className="notif-sub">{t.error}</div>
          </div>
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
        </div>
      ))}
    </div>
  );
}
