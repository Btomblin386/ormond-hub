import { NextResponse } from "next/server";
import { addBrandSource, setBrandSourceEnabled, deleteBrandSource } from "../../../lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const POLL_URL = "https://jxlrnuyfracyygiksqdj.supabase.co/functions/v1/brand-listen";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4bHJudXlmcmFjeXlnaWtzcWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjQ1OTUsImV4cCI6MjA5MDIwMDU5NX0.std1mTdOV4bU4S7wygQ67NdganwPrI6b2HFBi1BXQJ8";

export async function POST(req) {
  try {
    const b = await req.json();
    if (b.op === "add") {
      if (!b.clientId) return NextResponse.json({ error: "missing clientId" }, { status: 400 });
      if (b.kind === "rss" && !b.url) return NextResponse.json({ error: "RSS source needs a feed URL" }, { status: 400 });
      const [row] = await addBrandSource(b);
      return NextResponse.json({ ok: true, id: row.id });
    }
    if (b.op === "toggle") { await setBrandSourceEnabled(b.id, b.enabled); return NextResponse.json({ ok: true }); }
    if (b.op === "delete") { await deleteBrandSource(b.id); return NextResponse.json({ ok: true }); }
    if (b.op === "poll") {
      const r = await fetch(POLL_URL, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}` }, body: JSON.stringify({ client_id: b.clientId }) });
      const d = await r.json();
      return NextResponse.json(d, { status: r.status });
    }
    return NextResponse.json({ error: "unknown op" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
