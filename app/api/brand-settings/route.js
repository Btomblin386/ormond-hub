import { NextResponse } from "next/server";
import { setBrandSettings, mergeBrandSettings } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { clientId, settings, merge } = await req.json();
    if (!clientId) return NextResponse.json({ error: "missing clientId" }, { status: 400 });
    if (merge && typeof merge === "object") await mergeBrandSettings(clientId, merge);
    else await setBrandSettings(clientId, settings || {});
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
