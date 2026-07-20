import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FN_URL = "https://jxlrnuyfracyygiksqdj.supabase.co/functions/v1/oauth-tiktok";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4bHJudXlmcmFjeXlnaWtzcWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjQ1OTUsImV4cCI6MjA5MDIwMDU5NX0.std1mTdOV4bU4S7wygQ67NdganwPrI6b2HFBi1BXQJ8";

export async function GET(req) {
  const origin = req.nextUrl.origin;
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const err = params.get("error_description") || params.get("error");
  const cookieState = req.cookies.get("tt_oauth_state")?.value;
  const brand = req.cookies.get("tt_oauth_client")?.value;
  const ret = req.cookies.get("tt_oauth_return")?.value || "/settings";

  const back = (q) => {
    const res = NextResponse.redirect(`${origin}${ret}${q}`);
    res.cookies.delete("tt_oauth_state"); res.cookies.delete("tt_oauth_client"); res.cookies.delete("tt_oauth_return");
    return res;
  };

  if (err) return back(`?tt_error=${encodeURIComponent(err)}`);
  if (!code || !state || state !== cookieState || !brand) {
    return back(`?tt_error=${encodeURIComponent("TikTok login could not be verified — try again.")}`);
  }

  try {
    const resp = await fetch(FN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}` },
      body: JSON.stringify({ action: "exchange", code, redirect_uri: `${origin}/api/oauth/tiktok/callback`, client_id: brand }),
    });
    const d = await resp.json();
    if (d.error) return back(`?tt_error=${encodeURIComponent(d.error)}`);
    return back(`?tt_ok=${encodeURIComponent(d.username || d.display_name || "connected")}`);
  } catch (e) {
    return back(`?tt_error=${encodeURIComponent(String(e))}`);
  }
}
