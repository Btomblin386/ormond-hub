import { NextResponse } from "next/server";

export async function GET(req) {
  const res = NextResponse.redirect(new URL("/login", req.url), 303);
  res.cookies.set("hub_auth", "", { path: "/", maxAge: 0 });
  return res;
}
