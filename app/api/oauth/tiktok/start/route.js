import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// user.info.basic -> identity; video.upload -> push videos to the brand's TikTok
// drafts (the audit-free path). video.publish (direct-to-feed) is added later,
// after TikTok approves the app.
const SCOPES = ["user.info.basic", "video.upload"].join(",");

export async function GET(req) {
  const origin = req.nextUrl.origin;
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const brand = req.nextUrl.searchParams.get("client") || "";
  const ret = req.nextUrl.searchParams.get("return") || (brand ? `/accounts/${brand}/settings` : "/settings");
  if (!clientKey) {
    return NextResponse.redirect(`${origin}${ret}?tt_error=${encodeURIComponent("TikTok isn't configured — set TIKTOK_CLIENT_KEY in the environment.")}`);
  }
  if (!brand) {
    return NextResponse.redirect(`${origin}/settings?tt_error=${encodeURIComponent("No brand selected for the TikTok connection.")}`);
  }
  const redirectUri = `${origin}/api/oauth/tiktok/callback`;
  const state = crypto.randomUUID();

  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.searchParams.set("client_key", clientKey);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);

  const res = NextResponse.redirect(url.toString());
  const opts = { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 600 };
  res.cookies.set("tt_oauth_state", state, opts);
  res.cookies.set("tt_oauth_client", brand, opts);
  res.cookies.set("tt_oauth_return", ret, opts);
  return res;
}
