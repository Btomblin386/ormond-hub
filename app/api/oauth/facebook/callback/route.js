import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const FN_URL = "https://jxlrnuyfracyygiksqdj.supabase.co/functions/v1/oauth-facebook";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4bHJudXlmcmFjeXlnaWtzcWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjQ1OTUsImV4cCI6MjA5MDIwMDU5NX0.std1mTdOV4bU4S7wygQ67NdganwPrI6b2HFBi1BXQJ8";

export async function GET(req) {
  const origin = req.nextUrl.origin;
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const err = params.get("error_description") || params.get("error");
  const cookieState = req.cookies.get("fb_oauth_state")?.value;

  if (err) return NextResponse.redirect(`${origin}/onboard?error=${encodeURIComponent(err)}`);
  if (!code || !state || state !== cookieState) {
    return NextResponse.redirect(`${origin}/onboard?error=${encodeURIComponent("Login could not be verified — try again.")}`);
  }

  try {
    const resp = await fetch(FN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}` },
      body: JSON.stringify({ action: "exchange", code, redirect_uri: `${origin}/api/oauth/facebook/callback` }),
    });
    const d = await resp.json();
    if (d.error || !d.session) {
      return NextResponse.redirect(`${origin}/onboard?error=${encodeURIComponent(d.error || "exchange failed")}`);
    }
    const res = NextResponse.redirect(`${origin}/onboard`);
    res.cookies.set("fb_onboard_session", d.session, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 1800 });
    res.cookies.delete("fb_oauth_state");
    return res;
  } catch (e) {
    return NextResponse.redirect(`${origin}/onboard?error=${encodeURIComponent(String(e))}`);
  }
}
