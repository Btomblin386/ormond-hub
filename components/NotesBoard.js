"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import WhenPicker from "./WhenPicker";

// Monday.com-style mini CRM: colored collapsible groups of items with a name,
// status, due date, reminder, assignee and free-form notes. Items hold one
// level of sub-items (e.g. riders under a race series) shown nested whenever
// the group is open. Items drag (or arrow) between groups; sub-items reorder
// within their parent; reminders surface in agency Notifications when due.

const STATUS = {
  none:    { label: "—",             bg: "#e5e7eb", fg: "#374151" },
  working: { label: "Working on it", bg: "#fdab3d", fg: "#7c3d00" },
  stuck:   { label: "Stuck",         bg: "#e2445c", fg: "#fff" },
  done:    { label: "Done",          bg: "#00c875", fg: "#fff" },
};
const GROUP_COLORS = ["#6366f1", "#00c875", "#fdab3d", "#e2445c", "#0ea5e9", "#a855f7", "#f43f5e", "#64748b"];

const pad = (n) => String(n).padStart(2, "0");
// ISO -> "YYYY-MM-DDTHH:mm" in the viewer's zone (WhenPicker's value format).
function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
// en-US 12-hour so every viewer reads the same thing regardless of OS locale.
function fmtWhen(v) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}
const initials = (name) => String(name || "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

async function post(body) {
  const r = await fetch("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}

export default function NotesBoard({ clientId, groups, teamMembers = [] }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [openItem, setOpenItem] = useState(null);    // expanded item id (item or sub-item)
  const [editName, setEditName] = useState(null);    // { kind: "group"|"item", id, value }
  const [addingIn, setAddingIn] = useState(null);    // group id with "+ Add item" open
  const [addingSubIn, setAddingSubIn] = useState(null); // parent item id with "+ Add sub-item" open
  const [newItem, setNewItem] = useState("");
  const [addingGroup, setAddingGroup] = useState(false);
  const [newGroup, setNewGroup] = useState("");
  const [colorFor, setColorFor] = useState(null);    // group id with the palette open
  const [detail, setDetail] = useState({});          // openItem's editable details
  const [drag, setDrag] = useState(null);            // { itemId, fromGroup, parentId }
  const [dragOver, setDragOver] = useState(null);    // { groupId, index, parentId }

  const run = async (key, body) => {
    setBusy(key);
    try { await post(body); router.refresh(); } finally { setBusy(""); }
  };

  /* ---------- groups ---------- */
  async function addGroup() {
    const name = newGroup.trim();
    if (!name) { setAddingGroup(false); return; }
    setNewGroup(""); setAddingGroup(false);
    await run("addgroup", { op: "add_group", clientId, name, color: GROUP_COLORS[groups.length % GROUP_COLORS.length] });
  }
  const toggleGroup = (g) => run("col" + g.id, { op: "update_group", id: g.id, collapsed: !g.collapsed });
  async function deleteGroup(g) {
    const n = g.items.reduce((s, i) => s + 1 + (i.subs?.length || 0), 0);
    if (n && !window.confirm(`Delete "${g.name}" and its ${n} item(s)? This can't be undone.`)) return;
    await run("delg" + g.id, { op: "delete_group", id: g.id });
  }

  /* ---------- rename (group or item) ---------- */
  async function saveName() {
    const e = editName;
    setEditName(null);
    if (!e || !e.value.trim()) return;
    if (e.kind === "group") await run("rn" + e.id, { op: "update_group", id: e.id, name: e.value.trim() });
    else await run("rn" + e.id, { op: "patch_item", id: e.id, name: e.value.trim() });
  }

  /* ---------- items ---------- */
  async function addItem(g, parent = null) {
    const name = newItem.trim();
    if (!name) { setAddingIn(null); setAddingSubIn(null); return; }
    setNewItem("");
    await run("add" + (parent ? parent.id : g.id), { op: "add_item", groupId: g.id, clientId, name, parentId: parent ? parent.id : null });
  }
  function openDetails(it) {
    if (openItem === it.id) { setOpenItem(null); return; }
    setOpenItem(it.id);
    setDetail({ body: it.body || "", dueAt: toLocalInput(it.due_at), remindAt: toLocalInput(it.remind_at), assignedTo: it.assigned_to || "" });
  }
  async function saveDetails(it) {
    await run("det" + it.id, {
      op: "item_details", id: it.id,
      body: detail.body.trim(),
      dueAt: detail.dueAt ? new Date(detail.dueAt).toISOString() : null,
      remindAt: detail.remindAt ? new Date(detail.remindAt).toISOString() : null,
      assignedTo: detail.assignedTo,
    });
    setOpenItem(null);
  }
  async function deleteItem(it) {
    const extra = it.subs?.length ? ` and its ${it.subs.length} sub-item(s)` : "";
    if (!window.confirm(`Delete "${it.name}"${extra}?`)) return;
    await run("del" + it.id, { op: "delete_item", id: it.id });
  }

  /* ---------- move / reorder ---------- */
  // Send the destination sibling list's full ordered id list; the server adopts
  // items dragged in from another group (a parent's sub-items follow it).
  async function placeItem(itemId, toGroupId, index, parentId = null) {
    const to = groups.find((g) => g.id === toGroupId);
    if (!to) return;
    const list = parentId
      ? (to.items.find((i) => i.id === parentId)?.subs || [])
      : to.items;
    const ids = list.map((i) => i.id).filter((id) => id !== itemId);
    ids.splice(Math.max(0, Math.min(index ?? ids.length, ids.length)), 0, itemId);
    await run("mv" + itemId, { op: "reorder", groupId: toGroupId, parentId, ids });
  }

  // Drops only land in the same nesting scope: top-level items onto top-level
  // targets (any group), sub-items among their own siblings.
  const dropProps = (groupId, index, parentId = null) => ({
    onDragOver: (e) => {
      if (!drag || (drag.parentId || null) !== (parentId || null)) return;
      if (drag.parentId && drag.fromGroup !== groupId) return;
      e.preventDefault(); e.stopPropagation(); setDragOver({ groupId, index, parentId });
    },
    onDrop: (e) => {
      if (!drag || (drag.parentId || null) !== (parentId || null)) return;
      e.preventDefault(); e.stopPropagation();
      const d = drag; setDrag(null); setDragOver(null);
      placeItem(d.itemId, groupId, index, parentId);
    },
  });

  /* ---------- shared row renderer (items + sub-items) ---------- */
  function renderRow(it, g, idx, parent) {
    const pid = parent ? parent.id : null;
    const renaming = editName?.kind === "item" && editName.id === it.id;
    const over = dragOver && dragOver.groupId === g.id && dragOver.index === idx && (dragOver.parentId || null) === pid;
    return (
      <div className={"ni" + (parent ? " sub" : "") + (drag?.itemId === it.id ? " dragging" : "") + (over ? " drop-before" : "")}
        draggable={!renaming}
        onDragStart={(e) => { setDrag({ itemId: it.id, fromGroup: g.id, parentId: pid }); e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/x-note", it.id); } catch {} }}
        onDragEnd={() => { setDrag(null); setDragOver(null); }}
        {...dropProps(g.id, idx, pid)}>
        <span className="ni-grip" title="Drag to move">⋮⋮</span>
        {!parent && it.subs?.length > 0 && (
          <button className="ni-caret" title={it.sub_open ? "Hide sub-items" : "Show sub-items"}
            onClick={() => run("so" + it.id, { op: "patch_item", id: it.id, subOpen: !it.sub_open })}>
            {it.sub_open ? "▾" : "▸"}
          </button>
        )}
        {renaming ? (
          <input className="ni-rename" autoFocus value={editName.value}
            onChange={(e) => setEditName({ ...editName, value: e.target.value })}
            onBlur={saveName} onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditName(null); }} />
        ) : (
          <span className={"ni-name" + (it.status === "done" ? " done" : "")} onClick={() => openDetails(it)} title="Open details">
            {it.name}
            {!parent && !it.sub_open && it.subs?.length > 0 && <span className="ni-subcount" title={`${it.subs.length} sub-item(s)`}>{it.subs.length}</span>}
            {it.body && <span className="ni-hasbody" title="Has notes">📝</span>}
          </span>
        )}
        <button className="ni-edit" title="Rename" onClick={() => setEditName({ kind: "item", id: it.id, value: it.name })}>✎</button>
        {!parent && (
          <button className="ni-edit" title="Add a sub-item"
            onClick={() => {
              if (!it.sub_open && it.subs?.length) run("so" + it.id, { op: "patch_item", id: it.id, subOpen: true });
              setAddingSubIn(it.id); setAddingIn(null); setNewItem("");
            }}>⤷+</button>
        )}
        <span className="ni-right">
          {it.assigned_to && <span className="ni-avatar" title={it.assigned_to}>{initials(it.assigned_to)}</span>}
          {it.remind_at && !it.remind_done && <span className="ni-bell" title={`Reminder ${fmtWhen(it.remind_at)}`}>🔔</span>}
          {it.due_at && (
            <span className={"ni-due" + (new Date(it.due_at).getTime() < Date.now() && it.status !== "done" ? " late" : "")}>
              {fmtWhen(it.due_at)}
            </span>
          )}
          <select className="ni-status" value={it.status} style={{ background: STATUS[it.status].bg, color: STATUS[it.status].fg }}
            onChange={(e) => run("st" + it.id, { op: "patch_item", id: it.id, status: e.target.value })}>
            {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
        </span>
      </div>
    );
  }

  function renderDetail(it, g, parent) {
    return (
      <div className={"ni-detail" + (parent ? " sub" : "")}>
        <label>Notes</label>
        <textarea rows={3} value={detail.body} onChange={(e) => setDetail((d) => ({ ...d, body: e.target.value }))} placeholder="Details, links, context…" />
        <div className="ni-detail-grid">
          <div>
            <label>Due date</label>
            <WhenPicker value={detail.dueAt} onChange={(v) => setDetail((d) => ({ ...d, dueAt: v }))} />
          </div>
          <div>
            <label>Reminder <span className="muted">(pops into Notifications when due)</span></label>
            <WhenPicker value={detail.remindAt} onChange={(v) => setDetail((d) => ({ ...d, remindAt: v }))} />
          </div>
          <div>
            <label>Assigned to</label>
            <select value={detail.assignedTo} onChange={(e) => setDetail((d) => ({ ...d, assignedTo: e.target.value }))}>
              <option value="">— nobody —</option>
              {teamMembers.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {!parent && (
            <div>
              <label>Move to group</label>
              <select value={g.id} onChange={(e) => { setOpenItem(null); placeItem(it.id, e.target.value); }}>
                {groups.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="ni-detail-actions">
          <button className="cal-approve" disabled={busy === "det" + it.id} onClick={() => saveDetails(it)}>{busy === "det" + it.id ? "Saving…" : "Save"}</button>
          <button className="social-btn" onClick={() => setOpenItem(null)}>Close</button>
          <button className="cal-reject" style={{ marginLeft: "auto" }} onClick={() => deleteItem(it)}>Delete {parent ? "sub-item" : "item"}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="notes-board">
      {groups.length === 0 && (
        <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>
          No groups yet — add one below to start the board (e.g. <b>Follow-ups</b>, <b>Ideas</b>, <b>Waiting on client</b>).
        </div>
      )}

      {groups.map((g) => (
        <div key={g.id} className="ng" style={{ "--gc": g.color }}>
          <div className="ng-head" {...dropProps(g.id, 0)}>
            <button className="ng-caret" onClick={() => toggleGroup(g)} title={g.collapsed ? "Expand" : "Collapse"}>{g.collapsed ? "▸" : "▾"}</button>
            {editName?.kind === "group" && editName.id === g.id ? (
              <input className="ng-rename" autoFocus value={editName.value}
                onChange={(e) => setEditName({ ...editName, value: e.target.value })}
                onBlur={saveName} onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditName(null); }} />
            ) : (
              <span className="ng-name" onClick={() => setEditName({ kind: "group", id: g.id, value: g.name })} title="Click to rename">{g.name}</span>
            )}
            <span className="ng-count">{g.items.length}</span>
            <span className="ng-tools">
              <button title="Group color" onClick={() => setColorFor(colorFor === g.id ? null : g.id)}>🎨</button>
              <button title="Move group up" onClick={() => run("gup" + g.id, { op: "move_group", id: g.id, dir: -1 })}>↑</button>
              <button title="Move group down" onClick={() => run("gdn" + g.id, { op: "move_group", id: g.id, dir: 1 })}>↓</button>
              <button title="Delete group" onClick={() => deleteGroup(g)}>🗑</button>
            </span>
          </div>
          {colorFor === g.id && (
            <div className="ng-palette">
              {GROUP_COLORS.map((c) => (
                <button key={c} style={{ background: c }} className={c === g.color ? "on" : ""}
                  onClick={() => { setColorFor(null); run("gc" + g.id, { op: "update_group", id: g.id, color: c }); }} />
              ))}
            </div>
          )}

          {!g.collapsed && (
            <div className="ng-items">
              {g.items.map((it, idx) => (
                <div key={it.id}>
                  {renderRow(it, g, idx, null)}
                  {openItem === it.id && renderDetail(it, g, null)}
                  {((it.subs?.length > 0 && it.sub_open) || addingSubIn === it.id) && (
                    <div className="ni-subs">
                      {it.sub_open && it.subs.map((s, si) => (
                        <div key={s.id}>
                          {renderRow(s, g, si, it)}
                          {openItem === s.id && renderDetail(s, g, it)}
                        </div>
                      ))}
                      {addingSubIn === it.id ? (
                        <div className="ni ni-add-row sub">
                          <input autoFocus value={newItem} placeholder="Sub-item name — Enter to add"
                            onChange={(e) => setNewItem(e.target.value)}
                            onBlur={() => addItem(g, it)}
                            onKeyDown={(e) => { if (e.key === "Enter") addItem(g, it); if (e.key === "Escape") { setNewItem(""); setAddingSubIn(null); } }} />
                        </div>
                      ) : (
                        <button className="ni-sub-add" onClick={() => { setAddingSubIn(it.id); setAddingIn(null); setNewItem(""); }}>+ Add sub-item</button>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {addingIn === g.id ? (
                <div className="ni ni-add-row">
                  <input autoFocus value={newItem} placeholder="Item name — Enter to add"
                    onChange={(e) => setNewItem(e.target.value)}
                    onBlur={() => addItem(g)}
                    onKeyDown={(e) => { if (e.key === "Enter") addItem(g); if (e.key === "Escape") { setNewItem(""); setAddingIn(null); } }} />
                </div>
              ) : (
                <button className="ni-add" {...dropProps(g.id, g.items.length)} onClick={() => { setAddingIn(g.id); setAddingSubIn(null); setNewItem(""); }}>+ Add item</button>
              )}
            </div>
          )}
        </div>
      ))}

      {addingGroup ? (
        <div className="ng-add-row">
          <input autoFocus value={newGroup} placeholder="Group name — Enter to add"
            onChange={(e) => setNewGroup(e.target.value)}
            onBlur={addGroup}
            onKeyDown={(e) => { if (e.key === "Enter") addGroup(); if (e.key === "Escape") { setNewGroup(""); setAddingGroup(false); } }} />
        </div>
      ) : (
        <button className="cmp-add" onClick={() => setAddingGroup(true)}>+ Add group</button>
      )}
    </div>
  );
}
