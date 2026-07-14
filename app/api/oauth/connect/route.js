import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const FN_URL = "https://jxlrnuyfracyygiksqdj.supabase.co/functions/v1/oauth-facebook";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4bHJudXlmcmFjeXlnaWtzcWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjQ1OTUsImV4cCI6MjA5MDIwMDU5NX0.std1mTdOV4bU4S7wygQ67NdganwPrI6b2HFBi1BXQJ8";

export async function POST(req) {
  try {
    const session = cookies().get("fb_onboard_session")?.value;
    if (!session) return NextResponse.json({ error: "no onboarding session — reconnect Facebook" }, { status: 400 });
    const body = await req.json();
    const resp = await fetch(FN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}` },
      body: JSON.stringify({ action: "connect", session, selections: body.selections || [] }),
    });
    const d = await resp.json();
    return NextResponse.json(d, { status: resp.status });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
