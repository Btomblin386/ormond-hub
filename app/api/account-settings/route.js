import { NextResponse } from "next/server";
import { setAccountCap, setAccountUrlParams } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const body = await req.json();
    const { accountId } = body;
    if (!accountId) return NextResponse.json({ error: "missing accountId" }, { status: 400 });

    if ("urlParams" in body) {
      let p = (body.urlParams || "").trim().replace(/^[?&]+/, "");
      if (p && !/^([\w.\-%]+=[^&]*)(&[\w.\-%]+=[^&]*)*$/.test(p)) {
        return NextResponse.json({ error: "Use key=value pairs joined by & (e.g. utm_source=facebook&utm_medium=paid)" }, { status: 400 });
      }
      await setAccountUrlParams(accountId, p || null);
      return NextResponse.json({ ok: true, urlParams: p || null });
    }

    const value = body.cap === "" || body.cap == null ? null : Number(body.cap);
    if (value != null && (!(value > 0) || value > 100000)) {
      return NextResponse.json({ error: "cap must be between 0 and 100000" }, { status: 400 });
    }
    await setAccountCap(accountId, value);
    return NextResponse.json({ ok: true, cap: value });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
