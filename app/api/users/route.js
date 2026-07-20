import { NextResponse } from "next/server";
import { getSession } from "../../../lib/session";
import { listUsers, createUser, deactivateUser, reactivateUser, setUserPassword } from "../../../lib/db";
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
      if (!b.id || !b.password || String(b.password).length < 6) return NextResponse.json({ error: "a password of at least 6 characters is required" }, { status: 400 });
      const { hash, salt } = hashPassword(String(b.password));
      await setUserPassword(b.id, hash, salt);
      return NextResponse.json({ ok: true });
    }
    if (!b.email || !b.password) return NextResponse.json({ error: "email and password required" }, { status: 400 });
    if (!["agency", "creator", "client"].includes(b.role)) return NextResponse.json({ error: "bad role" }, { status: 400 });
    if (b.role === "client" && !b.clientId) return NextResponse.json({ error: "client users need a brand" }, { status: 400 });
    const { hash, salt } = hashPassword(b.password);
    const [row] = await createUser({ email: b.email, name: b.name, role: b.role, clientId: b.clientId || null, hash, salt });
    return NextResponse.json({ ok: true, id: row.id });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
