import { NextResponse } from "next/server";
import { getSession } from "../../../lib/session";
import { dismissNotification } from "../../../lib/db";

export const dynamic = "force-dynamic";

// Dismiss an agency notification by its stable key (notif_dismissals). Agency-only.
export async function POST(req) {
  const s = getSession();
  if (s?.role !== "agency") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const b = await req.json();
    if (b.op !== "dismiss" || !b.key) return NextResponse.json({ error: "key required" }, { status: 400 });
    await dismissNotification(String(b.key));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
