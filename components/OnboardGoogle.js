"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardGoogle({ properties, clients, email }) {
  const router = useRouter();
  const [sel, setSel] = useState({}); // property_id -> { on, clientId, newName }
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [done, setDone] = useState(null);

  const available = properties.filter((p) => !p.connected);
  const already = properties.filter((p) => p.connected);

  function toggle(p) {
    setSel((s) => ({ ...s, [p.id]: s[p.id]?.on ? { ...s[p.id], on: false } : { on: true, clientId: "", newName: p.name } }));
  }
  const upd = (id, k, v) => setSel((s) => ({ ...s, [id]: { ...s[id], [k]: v } }));

  async function connect() {
    const on = Object.entries(sel).filter(([, v]) => v.on);
    if (on.some(([, v]) => !v.clientId)) { setMsg("Assign each selected property to a client (or choose “Create new client”)."); return; }
    const selections = on.map(([property_id, v]) => {
      const name = properties.find((p) => p.id === property_id)?.name || property_id;
      return v.clientId !== "__new" ? { property_id, name, client_id: v.clientId } : { property_id, name, new_name: (v.newName || "").trim() };
    });
    if (!selections.length) { setMsg("Pick at least one property to connect."); return; }
    if (selections.some((s) => !s.client_id && !s.new_name)) { setMsg("New clients need a name."); return; }
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/oauth/google-connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selections }) });
      const d = await r.json();
      if (d.error) setMsg("Error: " + d.error);
      else { setDone(d.results || []); router.refresh(); }
    } finally { setBusy(false); }
  }

  if (done) {
    return (
      <div className="panel">
        <h2>Google Analytics connected</h2>
        <p className="note">GA4 data starts flowing on the next scheduled ingest (3×/day) — reconciliation and product insights follow automatically.</p>
        {done.filter((r) => r.ok).map((r, i) => <div key={i} className="onb-done">✓ {r.property}</div>)}
        {done.filter((r) => r.error).map((r, i) => <div key={"e" + i} className="push-err">{r.property}: {r.error}</div>)}
        <a className="cmp-btn solid" style={{ display: "inline-block", textDecoration: "none", marginTop: 12 }} href="/accounts">Go to accounts →</a>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2>Choose GA4 properties to connect</h2>
      <p className="note">Signed in as {email || "Google"}. Check a property, then assign it to a client. Google Ads access was also granted — ad data hooks up automatically once the Google Ads developer token is approved.</p>
      {msg && <div className="mng-msg">{msg}</div>}

      {available.length === 0 && <div className="muted" style={{ fontSize: 13 }}>No new GA4 properties on this Google account — everything is already connected.</div>}

      {available.map((p) => {
        const s = sel[p.id] || {};
        return (
          <div key={p.id} className={"onb-row" + (s.on ? " on" : "")}>
            <label className="onb-check">
              <input type="checkbox" checked={!!s.on} onChange={() => toggle(p)} />
              <span className="onb-name">{p.name}</span>
              <span className="muted" style={{ fontSize: 11 }}>{p.account} · {p.id}</span>
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
