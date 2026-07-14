import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(req) {
  const origin = req.nextUrl.origin;
  const key = process.env.DROPBOX_APP_KEY;
  if (!key) {
    return NextResponse.redirect(`${origin}/onboard?error=${encodeURIComponent("Dropbox isn't configured yet — set DROPBOX_APP_KEY in the environment.")}`);
  }
  const redirectUri = `${origin}/api/oauth/dropbox/callback`;
  const state = crypto.randomUUID();

  const url = new URL("https://www.dropbox.com/oauth2/authorize");
  url.searchParams.set("client_id", key);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("token_access_type", "offline"); // refresh token for scheduled/browser-free use
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url.toString());
  res.cookies.set("dbx_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 600 });
  return res;
}
