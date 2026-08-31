"use client";
import { useState } from "react";

export default function ResetForm({ token }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    // Trim so an invisible space (pasted from a text or email) can't sneak
    // into the saved password and lock you out later.
    const a = pw.trim(), b = pw2.trim();
    if (a.length < 6) { setErr("Password must be at least 6 characters."); return; }
    if (a !== b) { setErr("Passwords don't match."); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ t: token, password: a }) });
      const d = await r.json();
      if (d.error) setErr(d.error);
      else setDone(true);
    } finally { setBusy(false); }
  }

  if (!token) return (
    <form className="login-box">
      <h1>Ormond Hub</h1>
      <div className="err">This reset link is missing its token — use the full link from the email, or request a new one.</div>
      <a className="login-alt" href="/forgot">Request a new link</a>
    </form>
  );
  if (done) return (
    <form className="login-box" method="GET" action="/login">
      <h1>Ormond Hub</h1>
      <p>Password updated ✓</p>
      <button type="submit">Sign in with your new password</button>
    </form>
  );
  return (
    <form className="login-box" onSubmit={submit}>
      <h1>Ormond Hub</h1>
      <p>Choose a new password.</p>
      {err && <div className="err">{err}</div>}
      <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="New password (≥ 6 characters)" autoComplete="new-password" autoFocus required />
      <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="Repeat new password" autoComplete="new-password" required />
      <button type="submit" disabled={busy}>{busy ? "Saving…" : "Set new password"}</button>
    </form>
  );
}
