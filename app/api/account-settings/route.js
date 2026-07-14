import { NextResponse } from "next/server";
import { setAccountCap } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const { accountId, cap } = await req.json();
    if (!accountId) return NextResponse.json({ error: "missing accountId" }, { status: 400 });
    const value = cap === "" || cap == null ? null : Number(cap);
    if (value != null && (!(value > 0) || value > 100000)) {
      return NextResponse.json({ error: "cap must be between 0 and 100000" }, { status: 400 });
    }
    await setAccountCap(accountId, value);
    return NextResponse.json({ ok: true, cap: value });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
