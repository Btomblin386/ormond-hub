"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUS = { new: "New", emailed: "Emailed", contacted: "Contacted" };

function fmtWhen(v) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}
const label = (s) => String(s || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export default function LeadsPanel({ clientId, client, leads, leadEmails, emailConfigured }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [emails, setEmails] = useState((leadEmails || []).join(", "));
  const [savedEmails, setSavedEmails] = useState(leadEmails || []);
  const [openId, setOpenId] = useState(null);
  const flash = (t) => { setMsg(t); setTimeout(() => setMsg(""), 6000); };

  // Which addresses are typed now, and whether they differ from what's saved.
  const parsed = emails.split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean);
  const dirty = JSON.stringify(parsed) !== JSON.stringify(savedEmails);

  async function saveEmails() {
    setBusy("emails");
    try {
      const r = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "set_emails", clientId, emails }) });
      const d = await r.json();
      if (d.error) flash("Error: " + d.error);
      else { setSavedEmails(d.emails || []); setEmails((d.emails || []).join(", ")); flash(d.emails?.length ? `Saved — new leads will be emailed to ${d.emails.join(", ")}.` : "Recipients cleared — leads are stored here but not emailed."); router.refresh(); }
    } finally { setBusy(""); }
  }
  async function mark(id, status) {
    setBusy(id);
    try {
      await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "mark", id, status }) });
      router.refresh();
    } finally { setBusy(""); }
  }
  async function emailLead(id) {
    setBusy(id + "em");
    try {
      const r = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "email_lead", id }) });
      const d = await r.json();
      if (d.error) flash("Error: " + d.error);
      else { flash(`Emailed to ${(d.to || []).join(", ")}.`); router.refresh(); }
    } finally { setBusy(""); }
  }
  async function sync() {
    setBusy("sync");
    try {
      const r = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "sync" }) });
      const d = await r.json();
      if (d.error) flash("Error: " + d.error);
      else {
        const mine = (d.results || []).filter((x) => x.client === client);
        const n = mine.reduce((s, x) => s + (x.inserted || 0), 0);
        flash(n ? `Pulled ${n} new lead(s).` : "Up to date — no new leads.");
        router.refresh();
      }
    } finally { setBusy(""); }
  }

  return (
    <div className="panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <h2>Leads</h2>
        <button className="social-btn" disabled={busy === "sync"} onClick={sync}>{busy === "sync" ? "Checking…" : "↻ Check for new leads"}</button>
      </div>
      <p className="note">Lead-form submissions from {client}&apos;s Meta ads, pulled automatically every 10 minutes. New leads are emailed to the recipients below — the email&apos;s Reply-To is the customer, so replying goes straight to them.</p>

      <div className="lead-config">
        {savedEmails.length > 0 ? (
          <div className="lead-recipients-ok">
            <span className="lead-ok-dot">✓</span>
            <span>New leads are emailed to <b>{savedEmails.join(", ")}</b> — the customer&apos;s email is the Reply-To, so replying goes straight to them.</span>
          </div>
        ) : (
          <div className="lead-recipients-none">No recipients set yet — leads are collected below but <b>not emailed</b>. Add an address to start sending.</div>
        )}
        <label style={{ marginTop: 10 }}>{savedEmails.length ? "Change recipients" : "Email new leads to"} <span className="muted">(the shop&apos;s inbox — comma-separate multiple)</span></label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input type="text" value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="service@shop.com, mike@shop.com" style={{ flex: 1, minWidth: 260 }} />
          <button className="push-create" disabled={busy === "emails" || !dirty} onClick={saveEmails}>{busy === "emails" ? "Saving…" : dirty ? "Save recipients" : "✓ Saved"}</button>
        </div>
        {!emailConfigured && <div className="cmp-warn" style={{ marginTop: 8 }}>⚠ Email sending isn&apos;t configured yet (Resend key + domain). Leads are being collected here; emails start once it&apos;s set up in Settings.</div>}
      </div>

      {msg && <div className="mng-msg">{msg}</div>}

      {leads.length === 0 ? (
        <div className="muted" style={{ fontSize: 13 }}>No leads yet. They&apos;ll appear here as soon as someone submits a lead form.</div>
      ) : (
        <div className="lead-list">
          {leads.map((l) => (
            <div key={l.id} className="lead-row">
              <div className="lead-main" onClick={() => setOpenId(openId === l.id ? null : l.id)}>
                <div className="lead-top">
                  <span className={"cbadge " + (l.status === "contacted" ? "published" : l.status === "emailed" ? "approved" : "needs_approval")}>{STATUS[l.status] || l.status}</span>
                  <b>{l.full_name || "(no name)"}</b>
                  <span className="muted" style={{ fontSize: 12 }}>{l.platform === "ig" ? "Instagram" : "Facebook"} · {l.form_name || "Lead form"}</span>
                  <span className="content-when">{fmtWhen(l.created_time)}</span>
                </div>
                <div className="lead-contact">
                  {l.email && <a href={`mailto:${l.email}`} onClick={(e) => e.stopPropagation()}>{l.email}</a>}
                  {l.phone && <a href={`tel:${l.phone}`} onClick={(e) => e.stopPropagation()}>{l.phone}</a>}
                  {l.emailed_at && <span className="lead-sent" title="Notification email sent to the configured recipients">✉ Sent {fmtWhen(l.emailed_at)}</span>}
                  {l.email_error && <span className="err-txt" style={{ fontSize: 11.5 }}>⚠ email failed: {l.email_error}</span>}
                </div>
                {openId === l.id && (
                  <table className="lead-detail">
                    <tbody>
                      {(l.field_data || []).map((f, i) => (
                        <tr key={i}><td>{label(f.name)}</td><td><b>{(f.values || []).join(", ")}</b></td></tr>
                      ))}
                      {l.ad_name ? <tr><td>Ad</td><td>{l.ad_name}{l.campaign_name ? ` · ${l.campaign_name}` : ""}</td></tr> : null}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="content-actions">
                <button className="social-btn" disabled={busy === l.id + "em"} onClick={() => emailLead(l.id)}
                  title={l.emailed_at ? "Send this lead's email again" : "Email this lead to the configured recipients"}>
                  {busy === l.id + "em" ? "Sending…" : l.emailed_at ? "↻ Resend email" : "✉ Email lead"}
                </button>
                {l.status !== "contacted"
                  ? <button className="cal-approve" disabled={busy === l.id} onClick={() => mark(l.id, "contacted")}>Mark contacted</button>
                  : <button disabled={busy === l.id} onClick={() => mark(l.id, "new")}>Reopen</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
