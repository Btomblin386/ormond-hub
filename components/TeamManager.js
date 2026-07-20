"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const ROLE_LABEL = {
  agency: "Agency — full access",
  creator: "Creator — Content + Listen & Create",
  client: "Client — their brand's Content only",
};

export default function TeamManager({ users, clients }) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ name: "", email: "", role: "creator", clientId: "", password: "" });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  function flash(t) { setMsg(t); setTimeout(() => setMsg(""), 6000); }

  async function create() {
    if (!form.email || !form.password) { flash("Email and password are required."); return; }
    if (form.role === "client" && !form.clientId) { flash("Pick the brand this client can see."); return; }
    setBusy("create");
    try {
      const r = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await r.json();
      if (d.error) flash("Error: " + d.error);
      else { flash("User created."); setForm({ name: "", email: "", role: "creator", clientId: "", password: "" }); router.refresh(); }
    } finally { setBusy(""); }
  }
  async function remove(id) {
    if (!window.confirm("Deactivate this login?")) return;
    setBusy(id);
    try {
      await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "delete", id }) });
      router.refresh();
    } finally { setBusy(""); }
  }
  async function reactivate(id) {
    setBusy(id);
    try {
      await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "reactivate", id }) });
      router.refresh();
    } finally { setBusy(""); }
  }
  const [resetFor, setResetFor] = useState(null);
  const [newPass, setNewPass] = useState("");
  async function resetPassword(id) {
    if (newPass.length < 6) { flash("New password must be at least 6 characters."); return; }
    setBusy(id + "pw");
    try {
      const r = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "reset_password", id, password: newPass }) });
      const d = await r.json();
      if (d.error) flash("Error: " + d.error);
      else { flash("Password reset — send the new one to them. It also reactivates the login."); setResetFor(null); setNewPass(""); }
    } finally { setBusy(""); }
  }
  function randomPass() {
    const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    let p = "";
    for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)];
    setNewPass(p);
  }

  return (
    <div className="panel">
      <h2>Add a login</h2>
      {msg && <div className="mng-msg">{msg}</div>}
      <div className="rule-form">
        <div className="rule-grid">
          <div><label>Name</label><input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Brie" /></div>
          <div><label>Email</label><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="brie@…" /></div>
          <div><label>Temporary password</label><input type="text" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="they can use this to log in" /></div>
          <div>
            <label>Role</label>
            <select value={form.role} onChange={(e) => set("role", e.target.value)}>
              <option value="agency">Agency</option>
              <option value="creator">Creator</option>
              <option value="client">Client</option>
            </select>
          </div>
          {form.role === "client" && (
            <div>
              <label>Brand</label>
              <select value={form.clientId} onChange={(e) => set("clientId", e.target.value)}>
                <option value="">Select brand…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="muted" style={{ fontSize: 11, margin: "6px 0" }}>{ROLE_LABEL[form.role]}</div>
        <button className="push-create" onClick={create} disabled={busy === "create"}>{busy === "create" ? "Creating…" : "Create login"}</button>
      </div>

      <h2 style={{ marginTop: 18 }}>People</h2>
      <div className="content-list">
        {users.length === 0 && <div className="muted" style={{ fontSize: 13 }}>No per-user logins yet — you&apos;re signed in with the agency password.</div>}
        {users.map((u) => (
          <div key={u.id} className="content-row" style={{ flexWrap: "wrap" }}>
            <div className="content-main">
              <div className="content-top">
                <span className={"role-badge " + u.role}>{u.role}</span>
                <b>{u.name || u.email}</b>
                <span className="muted" style={{ fontSize: 12 }}>{u.email}</span>
                {u.client_name && <span className="pill content">{u.client_name}</span>}
                {u.active === false && <span className="pill" style={{ background: "#fee2e2", color: "#b91c1c" }}>deactivated</span>}
              </div>
            </div>
            <div className="content-actions">
              <button className="social-btn" disabled={busy === u.id + "pw"} onClick={() => { setResetFor(resetFor === u.id ? null : u.id); setNewPass(""); }}>{resetFor === u.id ? "Cancel" : "Reset password"}</button>
              {u.active === false
                ? <button className="cal-approve" disabled={busy === u.id} onClick={() => reactivate(u.id)}>Reactivate</button>
                : <button className="rule-del" disabled={busy === u.id} onClick={() => remove(u.id)}>Deactivate</button>}
            </div>
            {resetFor === u.id && (
              <div className="pw-reset">
                <input type="text" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="New temporary password (≥ 6 chars)" />
                <button className="social-btn" type="button" onClick={randomPass}>Generate</button>
                <button className="push-create" disabled={busy === u.id + "pw" || newPass.length < 6} onClick={() => resetPassword(u.id)}>{busy === u.id + "pw" ? "Saving…" : "Set password"}</button>
                <span className="muted" style={{ fontSize: 11, flexBasis: "100%" }}>You&apos;ll need to send this to them — the hub doesn&apos;t email it out.</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
