import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// analytics.readonly -> GA4 ingest; adwords -> Google Ads (usable once the
// developer token is approved); email -> label the connection.
const SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
  "https://www.googleapis.com/auth/adwords",
  "openid", "email",
].join(" ");

export async function GET(req) {
  const origin = req.nextUrl.origin;
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  if (!clientId) {
    return NextResponse.redirect(`${origin}/onboard?error=${encodeURIComponent("Google OAuth isn't configured yet — set GOOGLE_OAUTH_CLIENT_ID in the environment.")}`);
  }
  const redirectUri = `${origin}/api/oauth/google/callback`;
  const state = crypto.randomUUID();

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("access_type", "offline"); // we need a refresh token for scheduled ingest
  url.searchParams.set("prompt", "consent");      // force refresh_token issuance on reconnects
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url.toString());
  res.cookies.set("g_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 600 });
  return res;
}
