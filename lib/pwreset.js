import crypto from "crypto";
import { signSession, verifySession } from "./auth";

// Password-reset links: stateless HMAC tokens (same signer as sessions).
// Single-use without a table: the token embeds a fingerprint of the CURRENT
// password hash — once the password changes, the fingerprint no longer
// matches and the link is dead. Expires in 30 minutes.

const EMAIL_FN = "https://jxlrnuyfracyygiksqdj.supabase.co/functions/v1/send-email";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4bHJudXlmcmFjeXlnaWtzcWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjQ1OTUsImV4cCI6MjA5MDIwMDU5NX0.std1mTdOV4bU4S7wygQ67NdganwPrI6b2HFBi1BXQJ8";

const fingerprint = (hash) => crypto.createHash("sha256").update(String(hash || "")).digest("hex").slice(0, 16);

export function mintResetToken(user) {
  return signSession({ pr: user.id, fp: fingerprint(user.pass_hash), exp: Date.now() + 30 * 60 * 1000 });
}

// Returns the user id the token is for, or null. Expiry is checked by verifySession.
export function parseResetToken(token) {
  const p = verifySession(String(token || ""));
  return p?.pr ? p : null;
}

// True only if the token belongs to this user AND their password hasn't
// changed since the token was minted (that's what makes links one-time).
export function tokenMatchesUser(payload, user) {
  return !!payload && !!user && payload.pr === user.id && payload.fp === fingerprint(user.pass_hash);
}

export async function sendResetEmail(user, origin) {
  const link = `${origin}/reset-password?t=${encodeURIComponent(mintResetToken(user))}`;
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#111827;max-width:520px">
  <h2 style="margin:0 0 8px;font-size:17px">Reset your Ormond Hub password</h2>
  <div style="margin-bottom:18px">Hi ${user.name ? String(user.name).replace(/</g, "&lt;") : "there"} — someone (probably you, or your agency admin) asked for a password reset for <b>${String(user.email).replace(/</g, "&lt;")}</b>.</div>
  <a href="${link}" style="display:inline-block;background:#6366f1;color:#fff;font-weight:600;padding:11px 24px;border-radius:9px;text-decoration:none">Choose a new password</a>
  <div style="margin-top:18px;padding-top:12px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:12px">This link works once and expires in 30 minutes. If you didn't ask for it, you can safely ignore this email — your password is unchanged.</div>
</div>`;
  const r = await fetch(EMAIL_FN, {
    method: "POST", headers: { Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "password_reset", to: [user.email], fromName: "Ormond Hub", subject: "Reset your Ormond Hub password", html }),
  });
  return r.json();
}
