"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_LABEL = {
  draft: "Draft", needs_approval: "Needs approval", needs_revisions: "Needs revisions", approved: "Approved",
  scheduled: "Scheduled", publishing: "Publishing", published: "Published", failed: "Failed",
};
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n) => String(n).padStart(2, "0");
function keyOf(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function fmtTime(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function ContentCalendar({ items, onCreateOnDate, title, showClient }) {
  const router = useRouter();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [sel, setSel] = useState(null);
  const [busy, setBusy] = useState("");
  const [dragId, setDragId] = useState(null);
  const [overKey, setOverKey] = useState(null);
  const [menu, setMenu] = useState(null); // {x,y,key}
  const [qCaption, setQCaption] = useState("");
  const [qNote, setQNote] = useState("");
  useEffect(() => { setQCaption(sel?.caption || ""); setQNote(sel?.note || ""); }, [sel]);

  async function post(op, body) {
    await fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op, ...body }) });
    router.refresh();
  }
  async function saveQuick() { setBusy("q"); try { await post("patch", { id: sel.id, caption: qCaption, note: qNote }); setSel(null); } finally { setBusy(""); } }
  async function reqRevisions() { setBusy("q"); try { await post("revisions", { id: sel.id, note: qNote }); setSel(null); } finally { setBusy(""); } }
  function openComposer() { setSel(null); router.push(`/accounts/${sel.client_id}/content?edit=${sel.id}`); }

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
        {title && <div className="cal-client">{title}</div>}
        <div className="cal-nav">
          <button onClick={() => setCursor(new Date(year, month - 1, 1))}>←</button>
          <div className="cal-title">{monthName}</div>
          <button onClick={() => setCursor(new Date(year, month + 1, 1))}>→</button>
        </div>
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
                  onClick={() => setSel(it)} title={`${STATUS_LABEL[it.status]} · ${it.caption || ""}`}>
                  <span className="chip-time">{fmtTime(it.scheduled_at)}</span>
                  <span className="chip-txt">{showClient ? it.client : (it.caption?.slice(0, 30) || STATUS_LABEL[it.status])}</span>
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

            {sel.status === "published" || sel.status === "publishing" ? (
              <div className="cal-modal-cap">{sel.caption || "(no caption)"}</div>
            ) : (
              <div className="cal-quick">
                <label>Caption</label>
                <textarea rows={3} value={qCaption} onChange={(e) => setQCaption(e.target.value)} />
                <label>Note {sel.status === "needs_revisions" ? "· revisions requested" : "(for the team)"}</label>
                <textarea rows={2} value={qNote} onChange={(e) => setQNote(e.target.value)} placeholder="Leave a note — e.g. for Brie to review…" />
                <div className="cal-quick-actions">
                  <button className="cal-approve" disabled={busy === "q"} onClick={saveQuick}>Save changes</button>
                  <button className="cal-reject" disabled={busy === "q"} onClick={reqRevisions}>Request revisions</button>
                  <button className="cal-reject" onClick={openComposer}>Open in composer →</button>
                </div>
              </div>
            )}
            {sel.error && <div className="push-err">{sel.error}</div>}
            <div className="cal-modal-actions">
              {(sel.status === "draft" || sel.status === "needs_revisions") && <button className="cal-reject" onClick={() => act(sel.id, "needs_approval")}>Submit for approval</button>}
              {["draft", "needs_approval", "needs_revisions"].includes(sel.status) && <button className="cal-approve" onClick={() => act(sel.id, "approved")}>Approve &amp; schedule</button>}
              {["needs_approval", "approved", "scheduled"].includes(sel.status) && <button className="cal-reject" onClick={() => act(sel.id, "draft")}>Send back to draft</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
