import { NextResponse } from "next/server";
import { setBrandSettings } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { clientId, settings } = await req.json();
    if (!clientId) return NextResponse.json({ error: "missing clientId" }, { status: 400 });
    await setBrandSettings(clientId, settings || {});
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
