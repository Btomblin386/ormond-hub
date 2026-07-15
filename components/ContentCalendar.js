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
function fmtDay(key) {
  return new Date(key + "T00:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export default function ContentCalendar({ items, notes = [], teamMembers = [], clientId, onCreateOnDate, title, showClient }) {
  const router = useRouter();
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [sel, setSel] = useState(null);
  const [selNote, setSelNote] = useState(null);
  const [dayMenu, setDayMenu] = useState(null);   // { key } -> action chooser
  const [noteForm, setNoteForm] = useState(null); // { key, title, assignee, time }
  const [daySheet, setDaySheet] = useState(null); // { key } -> bulk day view (agency calendar)
  const [dayChecked, setDayChecked] = useState([]);
  const [moveTo, setMoveTo] = useState("");
  const [busy, setBusy] = useState("");
  const [dragId, setDragId] = useState(null);
  const [overKey, setOverKey] = useState(null);
  const [qCaption, setQCaption] = useState("");
  const [qNote, setQNote] = useState("");
  useEffect(() => { setQCaption(sel?.caption || ""); setQNote(sel?.note || ""); }, [sel]);

  async function post(op, body, api = "/api/content") {
    await fetch(api, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op, ...body }) });
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
  const notesByDate = {};
  for (const n of notes) {
    if (n.due_at) (notesByDate[keyOf(new Date(n.due_at))] ||= []).push(n);
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

  function openDayMenu(key) {
    if (dragId) return;
    if (onCreateOnDate) { setDayMenu({ key }); return; }
    // Agency calendar: clicking a day opens the bulk sheet for that day's posts
    const dayItems = byDate[key] || [];
    if (dayItems.length) { setDaySheet({ key }); setDayChecked(dayItems.filter((i) => i.status !== "published" && i.status !== "publishing").map((i) => i.id)); setMoveTo(""); }
  }
  async function bulkDay(action) {
    if (!dayChecked.length) return;
    if (action === "delete" && !window.confirm(`Delete ${dayChecked.length} post(s)?`)) return;
    setBusy("sheet");
    try {
      for (const id of dayChecked) {
        if (action === "approve") await fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "status", id, status: "approved", approvedBy: "agency" }) });
        else if (action === "delete") await fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "delete", id }) });
        else if (action === "move" && moveTo) {
          const it = items.find((x) => x.id === id);
          const prev = it?.scheduled_at ? new Date(it.scheduled_at) : null;
          const hh = prev ? prev.getHours() : 9, mm = prev ? prev.getMinutes() : 0;
          const d = new Date(`${moveTo}T00:00:00`); d.setHours(hh, mm);
          await fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "reschedule", id, scheduledAt: d.toISOString() }) });
        }
      }
      setDaySheet(null); router.refresh();
    } finally { setBusy(""); }
  }
  async function saveNote() {
    if (!noteForm?.title?.trim()) return;
    setBusy("note");
    try {
      const when = new Date(`${noteForm.key}T${noteForm.time || "09:00"}`);
      const r = await fetch("/api/tasks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ op: "create", clientId, kind: "reminder", title: noteForm.title.trim(), dueAt: when.toISOString(), assignedTo: noteForm.assignee || null }),
      });
      const d = await r.json();
      if (!d.error) { setNoteForm(null); router.refresh(); }
    } finally { setBusy(""); }
  }
  async function noteOp(id, op) {
    setBusy(id + op);
    try {
      await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op, id }) });
      setSelNote(null); router.refresh();
    } finally { setBusy(""); }
  }

  const monthName = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });
  const todayKey = keyOf(new Date());

  return (
    <div>
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
          <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Tip: drag any post onto a day to schedule it.{onCreateOnDate ? " Click a day to create a post or add a note." : ""}</div>
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
          const dayNotes = notesByDate[key] || [];
          return (
            <div key={i}
              className={"cal-cell" + (key === todayKey ? " today" : "") + (overKey === key ? " dragover" : "") + (onCreateOnDate || dayItems.length ? " clickable-day" : "")}
              onClick={() => openDayMenu(key)}
              onDragOver={(e) => { if (dragId) { e.preventDefault(); setOverKey(key); } }}
              onDragLeave={() => setOverKey((k) => (k === key ? null : k))}
              onDrop={(e) => { e.preventDefault(); drop(d); }}
              onContextMenu={(e) => { if (onCreateOnDate) { e.preventDefault(); setDayMenu({ key }); } }}
            >
              <div className="cal-daynum">{d.getDate()}</div>
              {dayNotes.map((n) => (
                <button key={"n" + n.id} className="cal-notechip" onClick={(e) => { e.stopPropagation(); setSelNote(n); }}
                  title={`${n.title}${n.assigned_to ? " · " + n.assigned_to : ""}`}>
                  <span>📝</span><span className="chip-txt">{showClient ? n.client : n.title}</span>
                </button>
              ))}
              {dayItems.slice(0, 4).map((it) => (
                <button key={it.id} className={"cal-chip " + it.status} draggable
                  onDragStart={(e) => { e.stopPropagation(); setDragId(it.id); }} onDragEnd={() => setDragId(null)}
                  onClick={(e) => { e.stopPropagation(); setSel(it); }} title={`${STATUS_LABEL[it.status]} · ${it.caption || ""}`}>
                  <span className="chip-time">{fmtTime(it.scheduled_at)}</span>
                  <span className="chip-txt">{showClient ? it.client : (it.caption?.slice(0, 30) || STATUS_LABEL[it.status])}</span>
                </button>
              ))}
              {dayItems.length > 4 && <div className="cal-more">+{dayItems.length - 4}</div>}
            </div>
          );
        })}
      </div>

      {/* ------- day action chooser ------- */}
      {dayMenu && !noteForm && (
        <div className="cal-modal" onClick={() => setDayMenu(null)}>
          <div className="cal-modal-inner day-modal" onClick={(e) => e.stopPropagation()}>
            <button className="cal-x day-x" onClick={() => setDayMenu(null)}>×</button>
            <div className="day-ico">🗓</div>
            <h3 className="day-title">What would you like to do?</h3>
            <div className="day-sub">For <b>{fmtDay(dayMenu.key)}</b></div>
            <div className="day-cards">
              <button className="day-card post" onClick={() => {
                // Today -> now+30m (9:00 AM would already be in the past); future days -> 9:00 AM
                let seed = `${dayMenu.key}T09:00`;
                if (dayMenu.key === todayKey) {
                  const d = new Date(Date.now() + 30 * 60000 - new Date().getTimezoneOffset() * 60000);
                  seed = d.toISOString().slice(0, 16);
                }
                onCreateOnDate(seed); setDayMenu(null);
              }}>
                <span className="day-card-ico blue">＋</span>
                <span className="day-card-name">Create post</span>
                <span className="day-card-desc">Compose and schedule a post for this date</span>
              </button>
              <button className="day-card note" onClick={() => { setNoteForm({ key: dayMenu.key, title: "", assignee: "", time: "09:00" }); setDayMenu(null); }}>
                <span className="day-card-ico amber">📝</span>
                <span className="day-card-name">Add note</span>
                <span className="day-card-desc">A dated note or reminder — assign it to a teammate</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------- note form ------- */}
      {noteForm && (
        <div className="cal-modal" onClick={() => setNoteForm(null)}>
          <div className="cal-modal-inner day-modal" onClick={(e) => e.stopPropagation()}>
            <button className="cal-x day-x" onClick={() => setNoteForm(null)}>×</button>
            <h3 className="day-title">Add a note</h3>
            <div className="day-sub">{fmtDay(noteForm.key)}</div>
            <div className="note-form">
              <textarea rows={3} autoFocus value={noteForm.title} onChange={(e) => setNoteForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Confirm fantasy-league picks link before this goes out…" />
              <div className="note-form-row">
                <select value={noteForm.assignee} onChange={(e) => setNoteForm((f) => ({ ...f, assignee: e.target.value }))}>
                  <option value="">No assignee</option>
                  {teamMembers.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <input type="time" value={noteForm.time} onChange={(e) => setNoteForm((f) => ({ ...f, time: e.target.value }))} />
                <button className="cal-approve" disabled={busy === "note" || !noteForm.title.trim()} onClick={saveNote}>{busy === "note" ? "Saving…" : "Save note"}</button>
              </div>
              <div className="muted" style={{ fontSize: 11 }}>Notes surface in agency Notifications when due.</div>
            </div>
          </div>
        </div>
      )}

      {/* ------- agency day sheet: bulk approve / move / delete ------- */}
      {daySheet && (
        <div className="cal-modal" onClick={() => setDaySheet(null)}>
          <div className="cal-modal-inner day-modal dbx-modal" onClick={(e) => e.stopPropagation()}>
            <button className="cal-x day-x" onClick={() => setDaySheet(null)}>×</button>
            <h3 className="day-title">{fmtDay(daySheet.key)}</h3>
            <div className="day-sub">{(byDate[daySheet.key] || []).length} post(s) · select and act on them together</div>
            <div className="sheet-list">
              {(byDate[daySheet.key] || []).map((it) => {
                const locked = it.status === "published" || it.status === "publishing";
                return (
                  <label key={it.id} className={"sheet-row" + (locked ? " locked" : "")}>
                    <input type="checkbox" disabled={locked} checked={dayChecked.includes(it.id)}
                      onChange={() => setDayChecked((c) => c.includes(it.id) ? c.filter((x) => x !== it.id) : [...c, it.id])} />
                    <span className={"cbadge " + it.status}>{STATUS_LABEL[it.status]}</span>
                    {showClient && <b style={{ fontSize: 12 }}>{it.client}</b>}
                    <span className="sheet-cap">{fmtTime(it.scheduled_at)} · {it.caption?.slice(0, 60) || "(no caption)"}</span>
                  </label>
                );
              })}
            </div>
            <div className="sheet-actions">
              <label className="bulk-all" style={{ marginRight: "auto" }}>
                <input type="checkbox"
                  checked={dayChecked.length > 0}
                  onChange={(e) => setDayChecked(e.target.checked ? (byDate[daySheet.key] || []).filter((i) => i.status !== "published" && i.status !== "publishing").map((i) => i.id) : [])} />
                {dayChecked.length} selected
              </label>
              <button className="cal-approve" disabled={busy === "sheet" || !dayChecked.length} onClick={() => bulkDay("approve")}>Approve</button>
              <input type="date" value={moveTo} onChange={(e) => setMoveTo(e.target.value)} style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "5px 8px", fontSize: 12 }} />
              <button className="cal-reject" disabled={busy === "sheet" || !dayChecked.length || !moveTo} onClick={() => bulkDay("move")}>Move</button>
              <button className="rule-del" disabled={busy === "sheet" || !dayChecked.length} onClick={() => bulkDay("delete")}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ------- note detail ------- */}
      {selNote && (
        <div className="cal-modal" onClick={() => setSelNote(null)}>
          <div className="cal-modal-inner day-modal" onClick={(e) => e.stopPropagation()}>
            <button className="cal-x day-x" onClick={() => setSelNote(null)}>×</button>
            <h3 className="day-title">📝 Note</h3>
            <div className="day-sub">{selNote.due_at ? new Date(selNote.due_at).toLocaleString() : ""}{showClient && selNote.client ? ` · ${selNote.client}` : ""}</div>
            <div className="note-body">{selNote.title}</div>
            <div className="note-meta">
              {selNote.created_by && <span>Added by <b>{selNote.created_by}</b></span>}
              {selNote.assigned_to && <span className="note-assignee">→ assigned to <b>{selNote.assigned_to}</b></span>}
            </div>
            <div className="cal-modal-actions">
              <button className="cal-approve" disabled={busy === selNote.id + "dismiss"} onClick={() => noteOp(selNote.id, "dismiss")}>Mark done</button>
              <button className="cal-reject" disabled={busy === selNote.id + "delete"} onClick={() => noteOp(selNote.id, "delete")}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ------- content item quick view ------- */}
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
              {sel.status !== "published" && sel.status !== "publishing" && (
                <button className="rule-del" disabled={busy === "del"} onClick={async () => {
                  if (!window.confirm("Delete this post?")) return;
                  setBusy("del");
                  try { await post("delete", { id: sel.id }); setSel(null); } finally { setBusy(""); }
                }}>Delete</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
