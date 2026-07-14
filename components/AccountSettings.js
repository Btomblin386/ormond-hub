"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

async function post(url, body) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}

export default function AccountSettings({ acct, socials, ga4, brand, dropboxEmail }) {
  const router = useRouter();
  const [name, setName] = useState(acct.client);
  const [desc, setDesc] = useState(brand?.business_desc || "");
  const [cap, setCap] = useState(acct.max_daily_budget ?? "");
  const [tags, setTags] = useState((acct.tags || []).join(", "));
  const [dbxFolder, setDbxFolder] = useState(brand?.dropbox_folder || "");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  function flash(t) { setMsg(t); setTimeout(() => setMsg(""), 6000); }

  async function run(key, fn, { reload } = {}) {
    setBusy(key);
    try {
      const d = await fn();
      if (d?.error) flash("Error: " + d.error);
      else if (reload) window.location.reload();
      else { flash("Saved."); router.refresh(); }
    } finally { setBusy(""); }
  }

  const saveName = () => {
    const t = name.trim();
    if (!t || t === acct.client) return;
    run("name", () => post("/api/account-settings", { clientId: acct.client_id, name: t }), { reload: true });
  };
  const saveDesc = () => run("desc", () => post("/api/brand-settings", { clientId: acct.client_id, settings: { ...(brand || {}), business_desc: desc } }));
  const saveTags = () => run("tags", () => post("/api/account-settings", { clientId: acct.client_id, tags: tags.split(",").map((t) => t.trim()).filter(Boolean) }));
  const saveDbxFolder = () => {
    let p = dbxFolder.trim();
    if (p && !p.startsWith("/")) p = "/" + p;
    run("dbx", () => post("/api/brand-settings", { clientId: acct.client_id, settings: { ...(brand || {}), dropbox_folder: p } }));
  };
  const saveCap = () => run("cap", () => post("/api/account-settings", { accountId: acct.ad_account_id, cap }));
  const disconnectSocial = (s) => {
    if (!window.confirm(`Disconnect ${s.fb_page_name || "this Page"}${s.ig_username ? " / @" + s.ig_username : ""}? Scheduled posts for this identity will fail until it's reconnected.`)) return;
    run("soc" + s.id, () => post("/api/account-settings", { disconnectSocialId: s.id }), { reload: true });
  };
  const disconnectGa4 = () => {
    if (!window.confirm("Disconnect Google Analytics for this brand? Already-ingested data is kept; new data stops flowing.")) return;
    run("ga4", () => post("/api/account-settings", { clientId: acct.client_id, removeGa4: true }), { reload: true });
  };

  return (
    <>
      {msg && <div className="mng-msg">{msg}</div>}

      <div className="panel">
        <h2>Brand</h2>
        <div className="set-row">
          <label>Display name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          <button className="social-btn" onClick={saveName} disabled={busy === "name" || !name.trim() || name.trim() === acct.client}>Rename</button>
        </div>
        <div className="set-row" style={{ alignItems: "flex-start" }}>
          <label>What this business sells<div className="muted" style={{ fontSize: 10.5, fontWeight: 400 }}>guides all AI features</div></label>
          <textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. an adventure-motorcycle luggage and soft-bag maker for long-distance riders" />
          <button className="social-btn" onClick={saveDesc} disabled={busy === "desc"}>Save</button>
        </div>
        <div className="set-row">
          <label>Tags<div className="muted" style={{ fontSize: 10.5, fontWeight: 400 }}>comma-separated · shown on the accounts list</div></label>
          <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. fantasy league, retainer, priority" />
          <button className="social-btn" onClick={saveTags} disabled={busy === "tags"}>Save tags</button>
        </div>
      </div>

      <div className="panel">
        <h2>Facebook &amp; Instagram</h2>
        <p className="note">Identities this brand can post and listen as. One brand can have several (e.g. two locations).</p>
        {socials.length === 0 && <div className="muted" style={{ fontSize: 13, marginBottom: 10 }}>No Pages connected.</div>}
        {socials.map((s) => (
          <div key={s.id} className="set-conn">
            <span className="social-ok">✓</span>
            <span className="set-conn-name">{s.fb_page_name || s.fb_page_id}</span>
            {s.ig_username && <span className="social-ig">@{s.ig_username}</span>}
            <button className="rule-del" disabled={busy === "soc" + s.id} onClick={() => disconnectSocial(s)}>Disconnect</button>
          </div>
        ))}
        <a className="social-btn" style={{ display: "inline-block", textDecoration: "none", marginTop: 6 }} href="/onboard">+ Connect a Page</a>
      </div>

      <div className="panel">
        <h2>Google Analytics</h2>
        {ga4 ? (
          <div className="set-conn">
            <span className="social-ok">✓</span>
            <span className="set-conn-name">Property {ga4.property_id}{ga4.domain ? ` · ${ga4.domain}` : ""}</span>
            <span className="muted" style={{ fontSize: 11 }}>{ga4.auth_kind === "oauth" ? `Google login${ga4.account_email ? " (" + ga4.account_email + ")" : ""}` : "service account"}</span>
            <button className="rule-del" disabled={busy === "ga4"} onClick={disconnectGa4}>Disconnect</button>
          </div>
        ) : (
          <>
            <p className="note">No GA4 property connected — store revenue, attribution reconciliation, and product insights need one.</p>
            <a className="social-btn" style={{ display: "inline-block", textDecoration: "none" }} href="/onboard">+ Connect Google Analytics</a>
          </>
        )}
      </div>

      <div className="panel">
        <h2>Dropbox</h2>
        {dropboxEmail ? (
          <>
            <div className="set-conn">
              <span className="social-ok">✓</span>
              <span className="set-conn-name">Connected</span>
              <span className="muted" style={{ fontSize: 11 }}>{dropboxEmail} · shared across the agency</span>
            </div>
            <div className="set-row" style={{ marginTop: 8 }}>
              <label>Default folder for {acct.client}<div className="muted" style={{ fontSize: 10.5, fontWeight: 400 }}>the composer&apos;s Dropbox picker opens here</div></label>
              <input type="text" value={dbxFolder} onChange={(e) => setDbxFolder(e.target.value)} placeholder="/Clients/FunnelWeb/Social" />
              <button className="social-btn" onClick={saveDbxFolder} disabled={busy === "dbx"}>Save folder</button>
            </div>
          </>
        ) : (
          <>
            <p className="note">Connect the agency Dropbox once, then set a default folder per brand — the composer&apos;s &quot;Add from Dropbox&quot; picker opens straight to it.</p>
            <a className="social-btn" style={{ display: "inline-block", textDecoration: "none" }} href="/api/oauth/dropbox/start">+ Connect Dropbox</a>
          </>
        )}
      </div>

      <div className="panel">
        <h2>Meta ad account</h2>
        {acct.ad_account_id ? (
          <>
            <div className="set-conn">
              <span className="social-ok">✓</span>
              <span className="set-conn-name">{acct.external_account_id}</span>
              <span className="muted" style={{ fontSize: 11 }}>{acct.platform} · {acct.currency || "USD"}</span>
            </div>
            <div className="set-row" style={{ marginTop: 8 }}>
              <label>Max daily budget cap<div className="muted" style={{ fontSize: 10.5, fontWeight: 400 }}>blocks any budget write above this</div></label>
              <input type="number" min="0" value={cap} onChange={(e) => setCap(e.target.value)} placeholder="no cap" style={{ maxWidth: 140 }} />
              <button className="social-btn" onClick={saveCap} disabled={busy === "cap"}>Save cap</button>
            </div>
          </>
        ) : (
          <>
            <p className="note">No Meta ad account connected — paid performance, Campaign Studio, and rules are inactive for this brand.</p>
            <a className="social-btn" style={{ display: "inline-block", textDecoration: "none" }} href="/onboard">+ Connect accounts</a>
          </>
        )}
      </div>
    </>
  );
}
