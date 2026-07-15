import { NextResponse } from "next/server";
import { getSession } from "../../../lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Browse the agency Dropbox (list folders / get temporary links). The edge
// function holds the app secret and refresh token, and enforces the owner's
// hidden-folder list; the admin/set_hidden capabilities are agency-only here.
const FN_URL = "https://jxlrnuyfracyygiksqdj.supabase.co/functions/v1/oauth-dropbox";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4bHJudXlmcmFjeXlnaWtzcWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjQ1OTUsImV4cCI6MjA5MDIwMDU5NX0.std1mTdOV4bU4S7wygQ67NdganwPrI6b2HFBi1BXQJ8";

export async function POST(req) {
  try {
    const body = await req.json();
    if (!["list", "templink", "set_hidden"].includes(body.action)) return NextResponse.json({ error: "unknown action" }, { status: 400 });
    const role = getSession()?.role || "agency";
    if ((body.action === "set_hidden" || body.admin) && role !== "agency") {
      return NextResponse.json({ error: "Not permitted for your role" }, { status: 403 });
    }
    const resp = await fetch(FN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}` },
      body: JSON.stringify(body),
    });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
