"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const KIND_LABEL = {
  unapproved_post: "Unapproved post nearing publish time",
  publish_failed: "Post failed to publish",
};
const LEADS = [
  [15, "15 minutes"], [30, "30 minutes"], [60, "1 hour"], [120, "2 hours"],
  [240, "4 hours"], [480, "8 hours"], [720, "12 hours"], [1440, "24 hours"], [2880, "48 hours"],
];
const leadLabel = (m) => LEADS.find(([v]) => v === m)?.[1] || `${m} minutes`;

function describe(r) {
  const cals = r.client_ids?.length ? r.client_names.join(", ") : "all calendars";
  return r.kind === "unapproved_post"
    ? `If a post on ${cals} is still unapproved ${leadLabel(r.lead_minutes)} before its publish time → email ${r.emails.join(", ")} with a one-click Approve button.`
    : `If a post on ${cals} fails to publish → email ${r.emails.join(", ")} with the error and a link to retry.`;
}

const BLANK = { kind: "unapproved_post", clientIds: [], emails: "", leadMinutes: 30 };

export default function AlertRulesManager({ rules, clients, activity }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [confirmDel, setConfirmDel] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  function flash(t) { setMsg(t); setTimeout(() => setMsg(""), 6000); }

  async function post(payload) {
    const r = await fetch("/api/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    return r.json();
  }

  function startEdit(r) {
    setForm({ kind: r.kind, clientIds: r.client_ids || [], emails: (r.emails || []).join(", "), leadMinutes: r.lead_minutes });
    setEditId(r.id); setOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save() {
    if (!form.emails.trim()) { flash("Add at least one email address."); return; }
    setBusy("save");
    try {
      const d = await post({ op: editId ? "update" : "create", id: editId, ...form });
      if (d.error) flash("Error: " + d.error);
      else { flash(editId ? "Alert updated." : "Alert created — it's live, the next check runs within 5 minutes."); setOpen(false); setEditId(null); setForm(BLANK); router.refresh(); }
    } finally { setBusy(""); }
  }

  async function toggle(r) {
    setBusy(r.id);
    try { await post({ op: "toggle", id: r.id, enabled: !r.enabled }); router.refresh(); } finally { setBusy(""); }
  }

  async function del(id) {
    if (confirmDel !== id) { setConfirmDel(id); setTimeout(() => setConfirmDel(null), 4000); return; }
    setBusy(id);
    try { await post({ op: "delete", id }); router.refresh(); } finally { setBusy(""); setConfirmDel(null); }
  }

  async function testSend() {
    if (!form.emails.trim()) { flash("Add the email addresses first, then send a test."); return; }
    setBusy("test");
    try {
      const d = await post({ op: "test", emails: form.emails });
      flash(d.error ? "Test failed: " + d.error : "Test email sent — check the inbox (and spam, the first time).");
    } finally { setBusy(""); }
  }

  async function runNow() {
    setBusy("run");
    try {
      const d = await post({ op: "run" });
      flash(d.error ? "Error: " + d.error : d.sent ? `Check complete — ${d.sent} alert email${d.sent === 1 ? "" : "s"} sent.` : "Check complete — nothing currently needs an alert.");
      router.refresh();
    } finally { setBusy(""); }
  }

  const toggleClient = (id) => set("clientIds", form.clientIds.includes(id) ? form.clientIds.filter((x) => x !== id) : [...form.clientIds, id]);

  return (
    <>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h2>Email alerts</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="social-btn" disabled={busy === "run"} onClick={runNow}>{busy === "run" ? "Checking…" : "Run check now"}</button>
            <button className="studio-btn" onClick={() => { setOpen((o) => !o); setEditId(null); setForm(BLANK); }}>{open ? "Cancel" : "+ New alert"}</button>
          </div>
        </div>
        <p className="note">
          Checks run every 5 minutes. Each alert emails its recipients once per post — approving from the email takes one click, no login.
        </p>

        {msg && <div className="mng-msg">{msg}</div>}

        {open && (
          <div className="alert-form">
            <label className="alert-lbl">Alert type</label>
            <select value={form.kind} onChange={(e) => set("kind", e.target.value)}>
              {Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>

            {form.kind === "unapproved_post" && (
              <>
                <label className="alert-lbl">How far before publish time to alert</label>
                <select value={form.leadMinutes} onChange={(e) => set("leadMinutes", Number(e.target.value))}>
                  {LEADS.map(([v, l]) => <option key={v} value={v}>{l} before publish</option>)}
                </select>
              </>
            )}

            <label className="alert-lbl">Calendars</label>
            <div className="alert-cals">
              <label className={"alert-cal" + (!form.clientIds.length ? " on" : "")}>
                <input type="checkbox" checked={!form.clientIds.length} onChange={() => set("clientIds", [])} />
                All calendars {form.clientIds.length ? "" : "✓"}
              </label>
              {clients.map((c) => (
                <label key={c.id} className={"alert-cal" + (form.clientIds.includes(c.id) ? " on" : "")}>
                  <input type="checkbox" checked={form.clientIds.includes(c.id)} onChange={() => toggleClient(c.id)} />
                  {c.name}
                </label>
              ))}
            </div>

            <label className="alert-lbl">Who gets the email</label>
            <input type="text" placeholder="you@agency.com, teammate@agency.com" value={form.emails} onChange={(e) => set("emails", e.target.value)} />

            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button className="studio-btn" disabled={busy === "save"} onClick={save}>{busy === "save" ? "Saving…" : editId ? "Save changes" : "Create alert"}</button>
              <button className="social-btn" disabled={busy === "test"} onClick={testSend}>{busy === "test" ? "Sending…" : "Send test email"}</button>
            </div>
          </div>
        )}

        {rules.length === 0 && !open ? (
          <div className="muted" style={{ fontSize: 13 }}>No alerts yet. Create one — e.g. “email me 30 minutes before an unapproved post is due to publish.”</div>
        ) : (
          rules.map((r) => (
            <div key={r.id} className={"rule-row" + (r.enabled ? "" : " off")}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{KIND_LABEL[r.kind]}{r.kind === "unapproved_post" ? ` · ${leadLabel(r.lead_minutes)} warning` : ""}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{describe(r)}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button className="social-btn" disabled={busy === r.id} onClick={() => toggle(r)}>{r.enabled ? "Pause" : "Resume"}</button>
                <button className="social-btn" onClick={() => startEdit(r)}>Edit</button>
                <button className="social-btn rule-del" disabled={busy === r.id} onClick={() => del(r.id)}>{confirmDel === r.id ? "Really delete?" : "Delete"}</button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="panel">
        <h2>Recent alert emails</h2>
        <p className="note">The last {activity.length || 30} alert emails sent, newest first.</p>
        {activity.length === 0 ? (
          <div className="muted" style={{ fontSize: 13 }}>Nothing sent yet.</div>
        ) : (
          activity.map((a) => (
            <div key={a.id} className="rule-row">
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.subject}</div>
                <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                  {new Date(a.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })}
                  {" · to "}{(a.to_emails || []).join(", ")}
                  {a.status === "failed" ? <span style={{ color: "#b91c1c" }}> · failed{a.error ? `: ${a.error}` : ""}</span> : ""}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
