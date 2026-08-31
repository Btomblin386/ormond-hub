import { NextResponse } from "next/server";
import { userByEmail } from "../../../lib/db";
import { signSession, verifyPassword } from "../../../lib/auth";

export const dynamic = "force-dynamic";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

function landingFor(role, clientId) {
  if (role === "client" && clientId) return `/accounts/${clientId}/content`;
  // ?li=1 marks "arrived here straight from a successful sign-in". If the
  // browser then shows the logged-out landing page, the session cookie was
  // dropped — the landing page uses the flag to explain that instead of
  // silently looping people back to Log in.
  return "/?li=1";
}

export async function POST(req) {
  const form = await req.formData();
  const email = String(form.get("email") || "").trim();
  // Trimmed: pasted passwords (from a text or email) often carry an invisible
  // trailing space/newline, which reads as "wrong password". Set-side trims too.
  const pw = String(form.get("password") || "").trim();
  const master = String(form.get("agency_master") || "") === "1";

  // Break-glass agency login: shared password, only from the /agency-master-login
  // form (which sets agency_master). A blank email on the normal /login no longer
  // triggers it. Requires the env secret to actually be set (fail closed).
  if (master) {
    const secret = process.env.DASHBOARD_PASSWORD || "";
    if (secret && pw === secret) {
      const res = NextResponse.redirect(new URL("/", req.url), 303);
      res.cookies.set("hub_auth", pw, { httpOnly: true, sameSite: "lax", path: "/", maxAge: THIRTY_DAYS });
      return res;
    }
    return NextResponse.redirect(new URL("/agency-master-login?e=1", req.url), 303);
  }

  // Per-user login.
  if (email && pw) {
    try {
      const u = await userByEmail(email);
      if (u && verifyPassword(pw, u.pass_hash, u.pass_salt)) {
        const token = signSession({
          uid: u.id, role: u.role, client_id: u.client_id || null,
          name: u.name || u.email, email: u.email,
          exp: Date.now() + THIRTY_DAYS * 1000,
        });
        // 200 + meta-refresh instead of Set-Cookie on a 303: certain in-app
        // browsers/webviews drop cookies attached to redirect responses, which
        // showed up as "signed in successfully but instantly logged out".
        const dest = landingFor(u.role, u.client_id);
        const html = `<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=${dest}"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Signing you in…</title><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;display:grid;place-items:center;height:100vh;margin:0;color:#6b7280">Signing you in…<script>location.replace(${JSON.stringify(dest)})</script></body>`;
        const res = new NextResponse(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
        res.cookies.set("hub_session", token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: THIRTY_DAYS });
        return res;
      }
    } catch (e) { /* fall through to error */ }
  }

  return NextResponse.redirect(new URL("/login?e=1", req.url), 303);
}
