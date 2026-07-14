"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const METRIC_LABEL = { roas: "ROAS", cpa: "CPA ($)", spend: "Spend ($)", conversions: "Conversions", frequency: "Frequency (fatigue)", ctr: "CTR % (fatigue)" };
const AD_LEVEL = new Set(["frequency", "ctr"]);

function describe(r) {
  const cmp = r.comparator === "lt" ? "drops below" : "rises above";
  const val = r.metric === "roas" ? `${r.threshold}x` : r.metric === "cpa" || r.metric === "spend" ? `$${r.threshold}` : r.metric === "ctr" ? `${r.threshold}%` : r.threshold;
  const scope = AD_LEVEL.has(r.metric) ? "an ad's" : "a campaign's";
  const target = AD_LEVEL.has(r.metric) ? "the ad" : "it";
  const act = r.action === "pause" ? (r.auto_apply ? `auto-pause ${target}` : `flag ${target} to pause`) : "notify me";
  return `If ${scope} ${METRIC_LABEL[r.metric]} ${cmp} ${val} over ${r.window_days}d (min $${r.min_spend} spend) → ${act}.`;
}

export default function RulesManager({ accountId, rules, events }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", metric: "roas", comparator: "lt", threshold: "1.5",
    windowDays: 3, minSpend: 20, action: "notify", autoApply: false,
  });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  function flash(t) { setMsg(t); setTimeout(() => setMsg(""), 6000); }

  async function post(payload, refresh = true) {
    const r = await fetch("/api/rules", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    if (refresh) router.refresh();
    return d;
  }

  async function create() {
    if (!form.name.trim()) { flash("Name your rule first."); return; }
    if (!(Number(form.threshold) >= 0)) { flash("Enter a valid threshold."); return; }
    setBusy("create");
    try {
      const d = await post({ op: "create", accountId, ...form });
      if (d.error) flash("Error: " + d.error);
      else { flash("Rule created."); setOpen(false); setForm({ ...form, name: "" }); }
    } finally { setBusy(""); }
  }

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2>Automated rules</h2>
        <button className="studio-btn" onClick={() => setOpen((o) => !o)}>{open ? "Cancel" : "+ New rule"}</button>
      </div>
      <p className="note">Rules run 3× daily after each data sync. They watch campaign performance and either notify you or, if you allow it, auto-pause — always within your daily spend cap and always logged.</p>

      {msg && <div className="mng-msg">{msg}</div>}

      {open && (
        <div className="rule-form">
          <label>Rule name</label>
          <input type="text" placeholder="Pause money-losers" value={form.name} onChange={(e) => set("name", e.target.value)} />

          <div className="rule-grid">
            <div>
              <label>Metric</label>
              <select value={form.metric} onChange={(e) => set("metric", e.target.value)}>
                {Object.entries(METRIC_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label>Condition</label>
              <select value={form.comparator} onChange={(e) => set("comparator", e.target.value)}>
                <option value="lt">below</option>
                <option value="gt">above</option>
              </select>
            </div>
            <div>
              <label>Threshold</label>
              <input type="number" step="any" value={form.threshold} onChange={(e) => set("threshold", e.target.value)} />
            </div>
            <div>
              <label>Window (days)</label>
              <input type="number" min="1" max="30" value={form.windowDays} onChange={(e) => set("windowDays", e.target.value)} />
            </div>
            <div>
              <label>Min spend ($)</label>
              <input type="number" min="0" value={form.minSpend} onChange={(e) => set("minSpend", e.target.value)} />
            </div>
            <div>
              <label>Action</label>
              <select value={form.action} onChange={(e) => set("action", e.target.value)}>
                <option value="notify">Notify only</option>
                <option value="pause">Pause campaign</option>
              </select>
            </div>
          </div>

          {form.action === "pause" && (
            <label className="rule-check">
              <input type="checkbox" checked={form.autoApply} onChange={(e) => set("autoApply", e.target.checked)} />
              Auto-apply without asking (otherwise it just flags the campaign for you to pause)
            </label>
          )}

          <button className="push-create" onClick={create} disabled={busy === "create"}>{busy === "create" ? "Creating…" : "Create rule"}</button>
        </div>
      )}

      {rules.length === 0 && !open && <div className="muted" style={{ fontSize: 13 }}>No rules yet — add one to start automating.</div>}

      {rules.map((r) => (
        <div key={r.id} className={"rule-row" + (r.enabled ? "" : " off")}>
          <div className="rule-main">
            <div className="rule-name">
              {r.name}
              {r.auto_apply && r.action === "pause" && <span className="rule-tag auto">auto</span>}
              {!r.enabled && <span className="rule-tag off">paused</span>}
            </div>
            <div className="rule-desc">{describe(r)}</div>
            {r.last_triggered_at && <div className="rule-when">Last triggered {new Date(r.last_triggered_at).toLocaleString()}</div>}
          </div>
          <div className="rule-actions">
            <button onClick={async () => { setBusy(r.id); await post({ op: "toggle", id: r.id, enabled: !r.enabled }); setBusy(""); }} disabled={busy === r.id}>
              {r.enabled ? "Disable" : "Enable"}
            </button>
            <button className="rule-del" onClick={async () => { if (!window.confirm(`Delete rule "${r.name}"?`)) return; setBusy(r.id); await post({ op: "delete", id: r.id }); setBusy(""); }} disabled={busy === r.id}>
              Delete
            </button>
          </div>
        </div>
      ))}

      {events.length > 0 && (
        <div className="mng-log">
          <div className="studio-h">Rule activity</div>
          {events.map((e) => (
            <div key={e.id} className={"rule-event" + (e.acknowledged ? " ack" : "")}>
              <span className={"log-status " + (e.action_taken === "paused" ? "ok" : "pending")}>{e.action_taken}</span>
              <span className="rule-event-msg">{e.message}</span>
              <span className="log-when">{new Date(e.created_at).toLocaleString()}</span>
              {!e.acknowledged && (
                <button className="rule-ack" onClick={async () => { await post({ op: "ack", id: e.id }); }}>Dismiss</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
