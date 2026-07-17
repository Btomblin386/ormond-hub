"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import CampaignLauncher from "./CampaignLauncher";
import CampaignTree from "./CampaignTree";

const money = (n) => "$" + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });

export default function AdsManager({ accountId, accountExt, cap, urlParams, campaigns, writes, clientId }) {
  const router = useRouter();
  const [capInput, setCapInput] = useState(cap == null ? "" : String(cap));
  const [paramsInput, setParamsInput] = useState(urlParams || "");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [budgets, setBudgets] = useState({});

  function flash(text) { setMsg(text); setTimeout(() => setMsg(""), 6000); }

  async function saveCap() {
    setBusy("cap");
    try {
      const r = await fetch("/api/account-settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, cap: capInput }),
      });
      const d = await r.json();
      flash(d.error ? `Error: ${d.error}` : `Daily cap saved: ${d.cap == null ? "none" : money(d.cap)}.`);
      router.refresh();
    } finally { setBusy(""); }
  }

  async function saveParams() {
    setBusy("params");
    try {
      const r = await fetch("/api/account-settings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, urlParams: paramsInput }),
      });
      const d = await r.json();
      flash(d.error ? `Error: ${d.error}` : d.urlParams ? "URL parameters saved." : "URL parameters cleared.");
      router.refresh();
    } finally { setBusy(""); }
  }

  async function manage(payload, confirmText) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(payload.target_id + payload.action);
    try {
      const r = await fetch("/api/manage", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, account_ext: accountExt }),
      });
      const d = await r.json();
      flash(d.error ? `Error: ${d.error}` : "Done.");
      router.refresh();
    } finally { setBusy(""); }
  }

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2>Ads management</h2>
        <CampaignLauncher accountExt={accountExt} clientId={clientId} />
      </div>
      <p className="note">Create or duplicate campaigns with an Instagram post as the creative, manage every campaign, ad set, and ad live from Meta. Everything is created paused; budget changes are capped, and every action is logged below.</p>

      {msg && <div className="mng-msg">{msg}</div>}

      <div className="studio-h" style={{ marginTop: 4 }}>Campaign structure — live from Meta</div>
      <CampaignTree accountExt={accountExt} clientId={clientId} />

      <div className="mng-cap">
        <label>Daily spend cap</label>
        <span className="mng-dollar">$</span>
        <input type="number" min="1" value={capInput} placeholder="none"
          onChange={(e) => setCapInput(e.target.value)} />
        <button onClick={saveCap} disabled={busy === "cap"}>{busy === "cap" ? "Saving…" : "Save cap"}</button>
        <span className="mng-hint">Budget increases above this are blocked.</span>
      </div>

      <div className="mng-cap">
        <label>URL parameters</label>
        <input type="text" style={{ width: 300 }} value={paramsInput} placeholder="utm_source=facebook&utm_medium=paid"
          onChange={(e) => setParamsInput(e.target.value)} />
        <button onClick={saveParams} disabled={busy === "params"}>{busy === "params" ? "Saving…" : "Save params"}</button>
        <span className="mng-hint">Auto-appended to destination URLs on every new campaign from Studio.</span>
      </div>

      <div className="studio-h" style={{ marginTop: 14 }}>Spend this window</div>
      <div className="mng-table-wrap">
        <table>
          <thead>
            <tr><th>Campaign</th><th>Spend (window)</th><th>New daily budget</th><th>Controls</th></tr>
          </thead>
          <tbody>
            {campaigns.length === 0 && <tr><td colSpan={4} className="muted">No managed campaigns in this window.</td></tr>}
            {campaigns.map((c) => (
              <tr key={c.campaign_id}>
                <td>{c.campaign}</td>
                <td>{money(c.spend)}</td>
                <td>
                  <div className="mng-budget">
                    <span>$</span>
                    <input type="number" min="1" placeholder="—"
                      value={budgets[c.campaign_id] ?? ""}
                      onChange={(e) => setBudgets({ ...budgets, [c.campaign_id]: e.target.value })} />
                    <button
                      disabled={!budgets[c.campaign_id]}
                      onClick={() => manage(
                        { action: "update_budget", target_id: c.campaign_id, target_type: "campaign", daily_budget: budgets[c.campaign_id] },
                        `Set ${c.campaign} to $${budgets[c.campaign_id]}/day?`
                      )}
                    >Apply</button>
                  </div>
                </td>
                <td>
                  <div className="mng-controls">
                    <button className="mng-pause"
                      onClick={() => manage({ action: "update_status", target_id: c.campaign_id, target_type: "campaign", status: "PAUSED" }, `Pause ${c.campaign}?`)}>
                      Pause
                    </button>
                    <button className="mng-resume"
                      onClick={() => manage({ action: "update_status", target_id: c.campaign_id, target_type: "campaign", status: "ACTIVE" }, `Resume ${c.campaign}? This can spend money.`)}>
                      Resume
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {writes.length > 0 && (
        <div className="mng-log">
          <div className="studio-h">Recent actions (audit log)</div>
          {writes.map((w, i) => (
            <div key={i} className={"log-row " + w.status}>
              <span className="log-action">{w.action.replace(/_/g, " ")}</span>
              <span className="log-target">{w.target_type || ""} {w.target_id ? "#" + String(w.target_id).slice(-6) : ""}</span>
              <span className={"log-status " + w.status}>{w.status}</span>
              <span className="log-when">{new Date(w.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
