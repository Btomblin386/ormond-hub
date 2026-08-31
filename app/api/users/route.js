import { NextResponse } from "next/server";
import { getSession } from "../../../lib/session";
import { listUsers, createUser, deactivateUser, reactivateUser, setUserPassword, setUserRole, userById } from "../../../lib/db";
import { sendResetEmail } from "../../../lib/pwreset";

const ROLES = ["agency", "manager", "creator", "client"];
import { hashPassword } from "../../../lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = getSession();
  if (s?.role !== "agency") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const users = await listUsers();
  return NextResponse.json({ users });
}

export async function POST(req) {
  const s = getSession();
  if (s?.role !== "agency") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const b = await req.json();
    if (b.op === "delete") { await deactivateUser(b.id); return NextResponse.json({ ok: true }); }
    if (b.op === "reactivate") { await reactivateUser(b.id); return NextResponse.json({ ok: true }); }
    if (b.op === "reset_password") {
      const password = String(b.password || "").trim();
      if (!b.id || password.length < 6) return NextResponse.json({ error: "a password of at least 6 characters is required" }, { status: 400 });
      const { hash, salt } = hashPassword(password);
      await setUserPassword(b.id, hash, salt);
      return NextResponse.json({ ok: true });
    }
    if (b.op === "send_reset") {
      const u = await userById(b.id);
      if (!u?.email) return NextResponse.json({ error: "user not found" }, { status: 404 });
      if (u.active === false) return NextResponse.json({ error: "that login is deactivated — reactivate it first" }, { status: 400 });
      const d = await sendResetEmail(u, new URL(req.url).origin);
      if (d.error) return NextResponse.json({ error: d.error }, { status: 502 });
      return NextResponse.json({ ok: true, to: u.email });
    }
    if (b.op === "set_role") {
      if (!ROLES.includes(b.role)) return NextResponse.json({ error: "bad role" }, { status: 400 });
      if (b.role === "client" && !b.clientId) return NextResponse.json({ error: "client users need a brand" }, { status: 400 });
      await setUserRole(b.id, b.role, b.role === "client" ? b.clientId : null);
      return NextResponse.json({ ok: true });
    }
    if (!b.email || !b.password) return NextResponse.json({ error: "email and password required" }, { status: 400 });
    if (!ROLES.includes(b.role)) return NextResponse.json({ error: "bad role" }, { status: 400 });
    if (b.role === "client" && !b.clientId) return NextResponse.json({ error: "client users need a brand" }, { status: 400 });
    const { hash, salt } = hashPassword(String(b.password).trim());
    const [row] = await createUser({ email: b.email, name: b.name, role: b.role, clientId: b.clientId || null, hash, salt });
    return NextResponse.json({ ok: true, id: row.id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
