import { NextResponse } from "next/server";

// Simple single-password gate for the private v1.
export function middleware(req) {
  const { pathname } = req.nextUrl;
  const isAuthPath =
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/login") ||
    pathname.startsWith("/privacy") ||         // public: required for Meta app review
    pathname.startsWith("/terms") ||           // public: required for Meta app review
    pathname.startsWith("/data-deletion");     // public: required for Meta app review
  const authed = req.cookies.get("hub_auth")?.value === process.env.DASHBOARD_PASSWORD;

  if (!authed && !isAuthPath) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
