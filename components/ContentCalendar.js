"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_LABEL = {
  draft: "Draft", needs_approval: "Needs approval", approved: "Approved",
  scheduled: "Scheduled", publishing: "Publishing", published: "Published", failed: "Failed",
};
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n) => String(n).padStart(2, "0");
function keyOf(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

export default function ContentCalendar({ items, onCreateOnDate }) {
  const router = useRouter();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState("");
  const [dragId, setDragId] = useState(null);
  const [overKey, setOverKey] = useState(null);
  const [menu, setMenu] = useState(null); // {x,y,key}

  const year = cursor.getFullYear(), month = cursor.getMonth();
  const startPad = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const byDate = {};
  const unscheduled = [];
  for (const it of items) {
    if (it.scheduled_at) (byDate[keyOf(new Date(it.scheduled_at))] ||= []).push(it);
    else if (it.status === "needs_approval" || it.status === "draft") unscheduled.push(it);
  }

  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

  async function act(id, status) {
    setBusy(id + status);
    try {
      await fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "status", id, status, approvedBy: "agency" }) });
      router.refresh(); setSel(null);
    } finally { setBusy(""); }
  }

  async function drop(targetDate) {
    const id = dragId; setDragId(null); setOverKey(null);
    if (!id) return;
    const it = items.find((x) => x.id === id);
    if (!it) return;
    const prev = it.scheduled_at ? new Date(it.scheduled_at) : null;
    const hh = prev ? prev.getHours() : 9, mm = prev ? prev.getMinutes() : 0;
    const when = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), hh, mm);
    if (prev && keyOf(prev) === keyOf(targetDate)) return;
    await fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "reschedule", id, scheduledAt: when.toISOString() }) });
    router.refresh();
  }

  const monthName = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });
  const todayKey = keyOf(new Date());

  return (
    <div onClick={() => menu && setMenu(null)}>
      {unscheduled.length > 0 && (
        <div className="cal-unsched">
          <div className="studio-h">Needs attention · no date set</div>
          {unscheduled.map((it) => (
            <div key={it.id} className={"cal-un-row" + (it.status === "needs_approval" ? " urgent" : "")} draggable
              onDragStart={() => setDragId(it.id)} onDragEnd={() => setDragId(null)} onClick={() => setSel(it)} style={{ cursor: "pointer" }}>
              <span className={"cbadge " + it.status}>{STATUS_LABEL[it.status]}</span>
              <span className="cal-un-client">{it.client}</span>
              <span className="cal-un-cap">{it.caption?.slice(0, 80) || "(no caption)"}</span>
              {(it.status === "needs_approval" || it.status === "draft") && <button className="cal-approve" disabled={busy === it.id + "approved"} onClick={(e) => { e.stopPropagation(); act(it.id, "approved"); }}>Approve</button>}
            </div>
          ))}
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Tip: drag any post onto a day to schedule it. {onCreateOnDate ? "Right-click a day to create a new post." : ""}</div>
        </div>
      )}

      <div className="cal-head">
        <button onClick={() => setCursor(new Date(year, month - 1, 1))}>←</button>
        <div className="cal-title">{monthName}</div>
        <button onClick={() => setCursor(new Date(year, month + 1, 1))}>→</button>
      </div>

      <div className="cal-grid cal-dow">{DOW.map((d) => <div key={d} className="cal-dowcell">{d}</div>)}</div>
      <div className="cal-grid">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="cal-cell empty" />;
          const key = keyOf(d);
          const dayItems = byDate[key] || [];
          return (
            <div key={i}
              className={"cal-cell" + (key === todayKey ? " today" : "") + (overKey === key ? " dragover" : "")}
              onDragOver={(e) => { if (dragId) { e.preventDefault(); setOverKey(key); } }}
              onDragLeave={() => setOverKey((k) => (k === key ? null : k))}
              onDrop={(e) => { e.preventDefault(); drop(d); }}
              onContextMenu={(e) => { if (onCreateOnDate) { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, key: `${key}T09:00` }); } }}
            >
              <div className="cal-daynum">{d.getDate()}</div>
              {dayItems.slice(0, 4).map((it) => (
                <button key={it.id} className={"cal-chip " + it.status} draggable
                  onDragStart={(e) => { e.stopPropagation(); setDragId(it.id); }} onDragEnd={() => setDragId(null)}
                  onClick={() => setSel(it)} title={it.caption}>
                  {it.client || STATUS_LABEL[it.status]}
                </button>
              ))}
              {dayItems.length > 4 && <div className="cal-more">+{dayItems.length - 4}</div>}
            </div>
          );
        })}
      </div>

      {menu && (
        <div className="cal-menu" style={{ top: menu.y, left: menu.x }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => { onCreateOnDate(menu.key); setMenu(null); }}>+ New post on this day</button>
        </div>
      )}

      {sel && (
        <div className="cal-modal" onClick={() => setSel(null)}>
          <div className="cal-modal-inner" onClick={(e) => e.stopPropagation()}>
            <div className="cal-modal-top">
              <span className={"cbadge " + sel.status}>{STATUS_LABEL[sel.status]}</span>
              <span className="cal-modal-client">{sel.client}</span>
              <button className="cal-x" onClick={() => setSel(null)}>×</button>
            </div>
            <div className="cal-modal-when">{(sel.channels || []).join(" + ")} · {sel.scheduled_at ? new Date(sel.scheduled_at).toLocaleString() : "no date"}</div>
            {Array.isArray(sel.media_urls) && sel.media_urls.length > 0 && (
              <div className="cal-modal-media">{sel.media_urls.slice(0, 4).map((u, j) => <img key={j} src={u} alt="" />)}</div>
            )}
            <div className="cal-modal-cap">{sel.caption || "(no caption)"}</div>
            {sel.error && <div className="push-err">{sel.error}</div>}
            <div className="cal-modal-actions">
              {sel.status === "draft" && <button className="cal-reject" onClick={() => act(sel.id, "needs_approval")}>Submit for approval</button>}
              {["draft", "needs_approval"].includes(sel.status) && <button className="cal-approve" onClick={() => act(sel.id, "approved")}>Approve &amp; schedule</button>}
              {["needs_approval", "approved", "scheduled"].includes(sel.status) && <button className="cal-reject" onClick={() => act(sel.id, "draft")}>Send back to draft</button>}
              {sel.status !== "published" && sel.status !== "publishing" && (
                <button className="cal-reject" onClick={() => { setSel(null); document.getElementById("posts")?.scrollIntoView({ behavior: "smooth" }); }}>Edit in Posts ↑</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
