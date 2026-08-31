import { NextResponse } from "next/server";
import { userById, setUserPassword } from "../../../lib/db";
import { hashPassword } from "../../../lib/auth";
import { parseResetToken, tokenMatchesUser } from "../../../lib/pwreset";

export const dynamic = "force-dynamic";

const EXPIRED = "That reset link is invalid or has expired — request a fresh one from the login page.";

export async function POST(req) {
  try {
    const b = await req.json();
    const p = parseResetToken(b.t);
    if (!p) return NextResponse.json({ error: EXPIRED }, { status: 400 });
    const u = await userById(p.pr);
    // Fingerprint mismatch = the password already changed since this link was
    // minted (link already used, or admin set one meanwhile) — link is dead.
    if (!u || u.active === false || !tokenMatchesUser(p, u)) return NextResponse.json({ error: EXPIRED }, { status: 400 });
    const password = String(b.password || "").trim();
    if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    const { hash, salt } = hashPassword(password);
    await setUserPassword(u.id, hash, salt);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
