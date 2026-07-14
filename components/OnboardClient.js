"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardClient({ pages, clients }) {
  const router = useRouter();
  const [sel, setSel] = useState({}); // page_id -> { on, clientId, newName }
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(null);

  const available = pages.filter((p) => !p.connected);
  const already = pages.filter((p) => p.connected);

  function toggle(p) {
    setSel((s) => ({ ...s, [p.id]: s[p.id]?.on ? { ...s[p.id], on: false } : { on: true, clientId: "", newName: p.name } }));
  }
  const upd = (id, k, v) => setSel((s) => ({ ...s, [id]: { ...s[id], [k]: v } }));

  async function connect() {
    const on = Object.entries(sel).filter(([, v]) => v.on);
    if (on.some(([, v]) => !v.clientId)) { setMsg("Assign each selected Page to a client (or choose “Create new client”)."); return; }
    const selections = on.map(([page_id, v]) => (
      v.clientId !== "__new" ? { page_id, client_id: v.clientId } : { page_id, new_name: (v.newName || "").trim() }
    ));
    if (!selections.length) { setMsg("Pick at least one Page to connect."); return; }
    if (selections.some((s) => !s.client_id && !s.new_name)) { setMsg("New clients need a name."); return; }
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/oauth/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selections }) });
      const d = await r.json();
      if (d.error) setMsg("Error: " + d.error);
      else { setDone(d.results || []); router.refresh(); }
    } finally { setBusy(false); }
  }

  if (done) {
    const ok = done.filter((r) => r.ok);
    return (
      <div className="panel">
        <h2>Connected</h2>
        <p className="note">These accounts are now in the hub — you can compose and listen for them right away.</p>
        {ok.map((r, i) => <div key={i} className="onb-done">✓ {r.page}{r.ig ? ` · @${r.ig}` : ""}</div>)}
        {done.filter((r) => r.error).map((r, i) => <div key={"e" + i} className="push-err">{r.page}: {r.error}</div>)}
        <a className="cmp-btn solid" style={{ display: "inline-block", textDecoration: "none", marginTop: 12 }} href="/accounts">Go to accounts →</a>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>Choose Pages to connect</h2>
      <p className="note">Check a Page, then assign it to an existing client or create a new one. Linked Instagram accounts come along automatically.</p>
      {msg && <div className="mng-msg">{msg}</div>}

      {available.length === 0 && <div className="muted" style={{ fontSize: 13 }}>No new Pages to connect — everything on this login is already in the hub.</div>}

      {available.map((p) => {
        const s = sel[p.id] || {};
        return (
          <div key={p.id} className={"onb-row" + (s.on ? " on" : "")}>
            <label className="onb-check">
              <input type="checkbox" checked={!!s.on} onChange={() => toggle(p)} />
              <span className="onb-name">{p.name}</span>
              {p.ig_username && <span className="social-ig">@{p.ig_username}</span>}
            </label>
            {s.on && (
              <div className="onb-map">
                <select value={s.clientId || ""} onChange={(e) => upd(p.id, "clientId", e.target.value)}>
                  <option value="" disabled>Assign to client…</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <option value="__new">➕ Create new client…</option>
                </select>
                {s.clientId === "__new" && (
                  <input type="text" value={s.newName || ""} onChange={(e) => upd(p.id, "newName", e.target.value)} placeholder="New client name" />
                )}
              </div>
            )}
          </div>
        );
      })}

      {already.length > 0 && (
        <div className="onb-already">
          <div className="studio-h">Already connected</div>
          {already.map((p) => <span key={p.id} className="src-chip"><span className="social-ok">✓</span> {p.name}</span>)}
        </div>
      )}

      <button className="cmp-btn solid" style={{ marginTop: 14 }} onClick={connect} disabled={busy}>{busy ? "Connecting…" : "Connect selected"}</button>
    </div>
  );
}
