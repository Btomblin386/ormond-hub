"use client";
import { useEffect, useState } from "react";

// Browse the agency Dropbox with real thumbnails and import selected images
// into the content-media bucket (Dropbox temporary links expire, so files are
// copied on import). Any folder can be saved as the brand's default.
export default function DropboxPicker({ clientId, startPath, onAdd, onClose }) {
  const [path, setPath] = useState(startPath || "");
  const [entries, setEntries] = useState(null);
  const [err, setErr] = useState("");
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState("");
  const [defaultPath, setDefaultPath] = useState(startPath || "");

  async function load(p) {
    setEntries(null); setErr(""); setPicked([]);
    try {
      const r = await fetch("/api/dropbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "list", path: p }) });
      const d = await r.json();
      if (d.error) setErr(d.error);
      else { setEntries(d.entries || []); setPath(d.path === "/" ? "" : d.path); }
    } catch (e) { setErr(String(e)); }
  }
  useEffect(() => { load(startPath || ""); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const up = () => load(path.split("/").slice(0, -1).join("/") || "");
  const togglePick = (p) => setPicked((s) => (s.includes(p) ? s.filter((x) => x !== p) : [...s, p]));

  async function importPicked() {
    setBusy("import");
    let ok = 0;
    try {
      for (const p of picked) {
        const r1 = await fetch("/api/dropbox", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "templink", path: p }) });
        const d1 = await r1.json();
        if (d1.error || !d1.link) continue;
        const r2 = await fetch("/api/content-media", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image_url: d1.link, filename: d1.name || "dropbox" }) });
        const d2 = await r2.json();
        if (d2.url) { onAdd(d2.url); ok++; }
      }
    } finally {
      setBusy("");
      if (ok) onClose();
      else setErr("Nothing imported — check the files and try again.");
    }
  }

  async function setDefault() {
    if (!clientId) return;
    setBusy("def");
    try {
      const r = await fetch("/api/brand-settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId, merge: { dropbox_folder: path || "" } }) });
      const d = await r.json();
      if (!d.error) setDefaultPath(path);
    } finally { setBusy(""); }
  }

  const folders = (entries || []).filter((e) => e.kind === "folder");
  const files = (entries || []).filter((e) => e.kind === "file");
  const isDefault = (path || "") === (defaultPath || "");

  return (
    <div className="cal-modal" onClick={onClose}>
      <div className="cal-modal-inner day-modal dbx-modal" onClick={(e) => e.stopPropagation()}>
        <button className="cal-x day-x" onClick={onClose}>×</button>
        <h3 className="day-title">Add from Dropbox</h3>
        <div className="dbx-path">
          <button className="social-btn" onClick={up} disabled={!path || !!busy}>↑ Up</button>
          <span className="dbx-crumb">{path || "/"}</span>
          {clientId && (
            isDefault
              ? <span className="dbx-default-on">✓ Default folder</span>
              : <button className="social-btn" onClick={setDefault} disabled={busy === "def"}>{busy === "def" ? "Saving…" : "Set as default"}</button>
          )}
        </div>
        {err && <div className="push-err">{err}</div>}
        {!entries && !err && <div className="muted" style={{ fontSize: 13 }}>Loading…</div>}
        {entries && (
          <>
            {folders.length > 0 && (
              <div className="dbx-folders">
                {folders.map((e) => (
                  <button key={e.path} className="dbx-folder" onClick={() => load(e.path)}>📁 {e.name}</button>
                ))}
              </div>
            )}
            {files.length === 0 && folders.length === 0 && <div className="muted" style={{ fontSize: 13 }}>Empty folder.</div>}
            {files.length > 0 && (
              <div className="dbx-grid">
                {files.map((e) => (
                  <button key={e.path} type="button" className={"dbx-tile" + (picked.includes(e.path) ? " on" : "")} onClick={() => togglePick(e.path)} title={e.name}>
                    {e.thumb
                      ? <img src={e.thumb} alt={e.name} />
                      : <span className="dbx-tile-ph">{/\.(mp4|mov)$/i.test(e.name) ? "🎬" : "🖼"}</span>}
                    <span className="dbx-tile-name">{e.name}</span>
                    <span className="dbx-tile-check">✓</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
        <div className="cal-modal-actions" style={{ marginTop: 12 }}>
          <button className="cal-approve" disabled={!picked.length || busy === "import"} onClick={importPicked}>
            {busy === "import" ? "Importing…" : `Import ${picked.length || ""} selected`}
          </button>
          <button className="cal-reject" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
