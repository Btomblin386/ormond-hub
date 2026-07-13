import { NextResponse } from "next/server";

export async function POST(req) {
  const form = await req.formData();
  const pw = form.get("password");
  if (pw && pw === process.env.DASHBOARD_PASSWORD) {
    const res = NextResponse.redirect(new URL("/", req.url), 303);
    res.cookies.set("hub_auth", String(pw), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  }
  return NextResponse.redirect(new URL("/login?e=1", req.url), 303);
}
