import { NextResponse } from "next/server";
import { userByEmail } from "../../../lib/db";
import { signSession, verifyPassword } from "../../../lib/auth";

export const dynamic = "force-dynamic";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

function landingFor(role, clientId) {
  if (role === "client" && clientId) return `/accounts/${clientId}/content`;
  return "/";
}

export async function POST(req) {
  const form = await req.formData();
  const email = String(form.get("email") || "").trim();
  const pw = String(form.get("password") || "");
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
        const res = NextResponse.redirect(new URL(landingFor(u.role, u.client_id), req.url), 303);
        res.cookies.set("hub_session", token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: THIRTY_DAYS });
        return res;
      }
    } catch (e) { /* fall through to error */ }
  }

  return NextResponse.redirect(new URL("/login?e=1", req.url), 303);
}
