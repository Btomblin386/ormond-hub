import { NextResponse } from "next/server";
import { accountsNav } from "../../../lib/db";
import { getSession } from "../../../lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const s = getSession();
    let accounts = await accountsNav();
    if (s?.role === "client" && s.client_id) accounts = accounts.filter((a) => a.id === s.client_id);
    return NextResponse.json({ accounts });
  } catch (e) {
    return NextResponse.json({ accounts: [], error: String(e) }, { status: 500 });
  }
}
