"use client";
import { useEffect, useState } from "react";

// Owner-level folder visibility for the agency Dropbox: hidden folders (and
// everything inside them) never appear in any brand's picker and can't be
// imported from — enforced server-side, this is just the management UI.
export default function DropboxFolderControl() {
  const [open, setOpen] = useState(false);
  const [path, setPath] = useState("");
  const [entries, setEntries] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");

  async function load(p) {
    setEntries(null); setErr("");
    try {
      const r = await fetch("/api/dropbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list", path: p, admin: true }) });
      const d = await r.json();
      if (d.error) setErr(d.error);
      else { setEntries((d.entries || []).filter((e) => e.kind === "folder")); setPath(d.path === "/" ? "" : d.path); }
    } catch (e) { setErr(String(e)); }
  }
  useEffect(() => { if (open) load(path); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);

  async function toggleHidden(e) {
    setBusy(e.path);
    try {
      await fetch("/api/dropbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "set_hidden", path: e.path, hidden: !e.hidden }) });
      setEntries((list) => list.map((x) => (x.path === e.path ? { ...x, hidden: !e.hidden } : x)));
    } finally { setBusy(""); }
  }

  if (!open) {
    return <button className="social-btn" style={{ marginTop: 8 }} onClick={() => setOpen(true)}>Manage folder visibility</button>;
  }
  return (
    <div className="dbx-vis">
      <div className="dbx-path" style={{ marginTop: 10 }}>
        <button className="social-btn" onClick={() => load(path.split("/").slice(0, -1).join("/") || "")} disabled={!path}>↑ Up</button>
        <span className="dbx-crumb">{path || "/"}</span>
        <button className="cal-x" style={{ marginLeft: "auto", fontSize: 16 }} onClick={() => setOpen(false)}>×</button>
      </div>
      <p className="note" style={{ margin: "4px 0 8px" }}>Ticking <b>Hidden</b> removes the folder — and everything inside it — from every brand&apos;s Dropbox picker. Click a folder name to go deeper.</p>
      {err && <div className="push-err">{err}</div>}
      {!entries && !err && <div className="muted" style={{ fontSize: 13 }}>Loading…</div>}
      {entries && entries.length === 0 && <div className="muted" style={{ fontSize: 13 }}>No subfolders here.</div>}
      {entries && entries.map((e) => (
        <div key={e.path} className={"set-conn" + (e.hidden ? " dbx-hiddenrow" : "")}>
          <button className="dbx-folder" style={{ border: 0, background: "transparent", padding: 0, fontWeight: 600 }} onClick={() => load(e.path)}>📁 {e.name}</button>
          <label className="bulk-all" style={{ marginLeft: "auto" }}>
            <input type="checkbox" checked={!!e.hidden} disabled={busy === e.path} onChange={() => toggleHidden(e)} />
            Hidden
          </label>
        </div>
      ))}
    </div>
  );
}
