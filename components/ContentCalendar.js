"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_LABEL = {
  draft: "Draft", needs_approval: "Needs approval", approved: "Approved",
  scheduled: "Scheduled", publishing: "Publishing", published: "Published", failed: "Failed",
};
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function ymd(d) { return d.toISOString().slice(0, 10); }

export default function ContentCalendar({ items }) {
  const router = useRouter();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState("");

  const year = cursor.getFullYear(), month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // group scheduled items by date
  const byDate = {};
  const unscheduled = [];
  for (const it of items) {
    if (it.scheduled_at) {
      const key = it.scheduled_at.slice(0, 10);
      (byDate[key] ||= []).push(it);
    } else if (it.status === "needs_approval" || it.status === "draft") {
      unscheduled.push(it);
    }
  }

  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  async function act(id, status) {
    setBusy(id + status);
    try {
      await fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "status", id, status, approvedBy: "agency" }) });
      router.refresh();
      setSel(null);
    } finally { setBusy(""); }
  }

  const monthName = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });
  const todayKey = ymd(new Date());

  return (
    <div>
      {unscheduled.length > 0 && (
        <div className="cal-unsched">
          <div className="studio-h">Needs attention · no date set</div>
          {unscheduled.map((it) => (
            <div key={it.id} className="cal-un-row">
              <span className={"cbadge " + it.status}>{STATUS_LABEL[it.status]}</span>
              <span className="cal-un-client">{it.client}</span>
              <span className="cal-un-cap">{it.caption?.slice(0, 80) || "(no caption)"}</span>
              {it.status === "needs_approval" && (
                <button className="cal-approve" disabled={busy === it.id + "approved"} onClick={() => act(it.id, "approved")}>Approve</button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="cal-head">
        <button onClick={() => setCursor(new Date(year, month - 1, 1))}>←</button>
        <div className="cal-title">{monthName}</div>
        <button onClick={() => setCursor(new Date(year, month + 1, 1))}>→</button>
      </div>

      <div className="cal-grid cal-dow">
        {DOW.map((d) => <div key={d} className="cal-dowcell">{d}</div>)}
      </div>
      <div className="cal-grid">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="cal-cell empty" />;
          const key = ymd(d);
          const dayItems = byDate[key] || [];
          return (
            <div key={i} className={"cal-cell" + (key === todayKey ? " today" : "")}>
              <div className="cal-daynum">{d.getDate()}</div>
              {dayItems.slice(0, 4).map((it) => (
                <button key={it.id} className={"cal-chip " + it.status} onClick={() => setSel(it)} title={it.caption}>
                  {it.client}
                </button>
              ))}
              {dayItems.length > 4 && <div className="cal-more">+{dayItems.length - 4}</div>}
            </div>
          );
        })}
      </div>

      {sel && (
        <div className="cal-modal" onClick={() => setSel(null)}>
          <div className="cal-modal-inner" onClick={(e) => e.stopPropagation()}>
            <div className="cal-modal-top">
              <span className={"cbadge " + sel.status}>{STATUS_LABEL[sel.status]}</span>
              <span className="cal-modal-client">{sel.client}</span>
              <button className="cal-x" onClick={() => setSel(null)}>×</button>
            </div>
            <div className="cal-modal-when">
              {(sel.channels || []).join(" + ")} · {sel.scheduled_at ? new Date(sel.scheduled_at).toLocaleString() : "no date"}
            </div>
            {Array.isArray(sel.media_urls) && sel.media_urls.length > 0 && (
              <div className="cal-modal-media">
                {sel.media_urls.slice(0, 4).map((u, j) => <img key={j} src={u} alt="" />)}
              </div>
            )}
            <div className="cal-modal-cap">{sel.caption || "(no caption)"}</div>
            {sel.error && <div className="push-err">{sel.error}</div>}
            <div className="cal-modal-actions">
              {sel.status === "needs_approval" && <button className="cal-approve" onClick={() => act(sel.id, "approved")}>Approve</button>}
              {["needs_approval", "approved", "scheduled"].includes(sel.status) && <button className="cal-reject" onClick={() => act(sel.id, "draft")}>Send back to draft</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
