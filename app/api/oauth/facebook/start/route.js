import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const APP_ID = "1516438426621167";
const GV = "v21.0";
const SCOPES = [
  "pages_show_list", "pages_read_engagement", "pages_read_user_content",
  "pages_manage_posts", "pages_manage_engagement",
  "instagram_basic", "instagram_content_publish", "instagram_manage_comments",
  "business_management",
].join(",");

export async function GET(req) {
  const origin = req.nextUrl.origin;
  const redirectUri = `${origin}/api/oauth/facebook/callback`;
  const state = crypto.randomUUID();

  const url = new URL(`https://www.facebook.com/${GV}/dialog/oauth`);
  url.searchParams.set("client_id", APP_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("response_type", "code");

  const res = NextResponse.redirect(url.toString());
  res.cookies.set("fb_oauth_state", state, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 600 });
  return res;
}
