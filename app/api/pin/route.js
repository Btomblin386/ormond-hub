import { NextResponse } from "next/server";
import { pinInsight, unpinInsight } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const body = await req.json();
    const { action, client, scope, category, title, detail } = body || {};
    if (!client || !title) {
      return NextResponse.json({ error: "missing client or title" }, { status: 400 });
    }
    if (action === "unpin") {
      await unpinInsight(client, { scope, title });
    } else {
      await pinInsight(client, { scope, category, title, detail });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
