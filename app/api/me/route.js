import { NextResponse } from "next/server";
import { getSession } from "../../../lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = getSession();
  if (!s) return NextResponse.json({ role: null });
  return NextResponse.json({ role: s.role, client_id: s.client_id || null, name: s.name || null });
}
