"use client";
import { useState } from "react";

export default function Forgot() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      setSent(true);
    } finally { setBusy(false); }
  }

  return (
    <form className="login-box" onSubmit={submit}>
      <h1>Ormond Hub</h1>
      {sent ? (
        <>
          <p>If <b>{email.trim()}</b> has a login, a reset link is on its way (check spam the first time). It works once and expires in 30 minutes.</p>
          <a className="login-alt" href="/login">← Back to sign in</a>
        </>
      ) : (
        <>
          <p>Enter your email and we&apos;ll send you a link to choose a new password.</p>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="username" autoFocus required />
          <button type="submit" disabled={busy}>{busy ? "Sending…" : "Email me a reset link"}</button>
          <a className="login-alt" href="/login">← Back to sign in</a>
        </>
      )}
    </form>
  );
}
