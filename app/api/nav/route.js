import { NextResponse } from "next/server";
import { accountsNav } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const accounts = await accountsNav();
    return NextResponse.json({ accounts });
  } catch (e) {
    return NextResponse.json({ accounts: [], error: String(e) }, { status: 500 });
  }
}
