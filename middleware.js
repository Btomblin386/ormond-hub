import { NextResponse } from "next/server";

const PUBLIC = ["/login", "/agency-master-login", "/api/login", "/api/media", "/api/meta-webhook", "/privacy", "/terms", "/data-deletion"];

// Paid-marketing APIs that creators/clients may not call
const PAID_APIS = ["/api/manage", "/api/create", "/api/rules", "/api/account-settings", "/api/campaign-plan", "/api/audiences", "/api/pin", "/api/users", "/api/analytics", "/api/analytics-summary", "/api/oauth", "/api/tasks", "/api/leads", "/api/inbox"];

function b64urlFromBytes(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function verifyToken(token, secret) {
  try {
    const [body, sig] = (token || "").split(".");
    if (!body || !sig || !secret) return null;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body)));
    if (b64urlFromBytes(mac) !== sig) return null;
    let b = body.replace(/-/g, "+").replace(/_/g, "/");
    while (b.length % 4) b += "=";
    const bytes = Uint8Array.from(atob(b), (ch) => ch.charCodeAt(0));
    const p = JSON.parse(new TextDecoder().decode(bytes));
    if (p.exp && Date.now() > p.exp) return null;
    return p;
  } catch { return null; }
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;

  // TikTok domain-ownership signature files (static, committed in /public) must
  // bypass auth so TikTok's verifier can fetch them without a login redirect.
  if (/^\/tiktok[A-Za-z0-9]+\.txt$/.test(pathname)) return NextResponse.next();

  // Fallback: serve a verification file straight from env vars (no commit needed)
  // — set TIKTOK_VERIFY_FILENAME + TIKTOK_VERIFY_BODY in Vercel.
  const ttFile = process.env.TIKTOK_VERIFY_FILENAME;
  if (ttFile && pathname === "/" + ttFile) {
    return new NextResponse(process.env.TIKTOK_VERIFY_BODY || ttFile, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();

  // The root is reachable logged-out: app/page.js shows a public landing page
  // (required as the OAuth "application home page") and the dashboard only
  // renders for a valid session.
  if (pathname === "/" && !req.cookies.get("hub_session") && !req.cookies.get("hub_auth")) {
    return NextResponse.next();
  }

  // FAIL CLOSED: with no server secret there is no way to verify anyone —
  // block everything rather than let everyone through. (A missing
  // DASHBOARD_PASSWORD env var once made `undefined === undefined` grant
  // agency access to anonymous visitors. Never again.)
  const secret = process.env.DASHBOARD_PASSWORD || "";
  let session = null;
  if (secret) {
    const tok = req.cookies.get("hub_session")?.value;
    if (tok) session = await verifyToken(tok, secret);
    const legacy = req.cookies.get("hub_auth")?.value;
    if (!session && legacy && legacy === secret) session = { role: "agency" };
  }

  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = secret ? "" : "?e=cfg";
    return NextResponse.redirect(url);
  }

  const role = session.role || "agency";
  const clientId = session.client_id || null;

  if (role === "agency") return NextResponse.next();

  // ---- CLIENT: locked to their own brand's Content only ----
  if (role === "client") {
    const home = clientId ? `/accounts/${clientId}/content` : "/login";
    const okApi = ["/api/content", "/api/content-media", "/api/nav", "/api/me", "/api/logout"];
    const allowed =
      (clientId && pathname.startsWith(`/accounts/${clientId}/content`)) ||
      okApi.some((a) => pathname.startsWith(a));
    if (!allowed) {
      const url = req.nextUrl.clone();
      url.pathname = home; url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ---- ACCOUNT MANAGER: everything a creator can do, PLUS the cross-account
  // agency overview (approvals, calendar, retries) and the messaging Inbox.
  // Still no paid marketing, agency/account settings, team, reconciliation,
  // onboarding, or billing. ----
  if (role === "manager") {
    // Inbox is engagement work, not paid marketing — managers may use it.
    if (!pathname.startsWith("/api/inbox") && PAID_APIS.some((a) => pathname.startsWith(a))) {
      return new NextResponse(JSON.stringify({ error: "Not permitted for your role" }), { status: 403, headers: { "Content-Type": "application/json" } });
    }
    const blockedPage =
      pathname.startsWith("/reconciliation") ||
      pathname.startsWith("/onboard") ||
      pathname.startsWith("/settings") ||
      pathname.startsWith("/team") ||
      pathname === "/assistant" ||
      /^\/accounts\/[^/]+$/.test(pathname) ||        // paid-marketing account root
      /^\/accounts\/[^/]+\/google/.test(pathname) ||    // google analytics/ads tab
      /^\/accounts\/[^/]+\/settings/.test(pathname) ||  // account settings
      /^\/accounts\/[^/]+\/leads/.test(pathname) ||    // meta lead ads (agency only)
      /^\/accounts\/[^/]+\/assistant/.test(pathname);   // account assistant
    if (blockedPage) {
      const url = req.nextUrl.clone();
      const m = pathname.match(/^\/accounts\/([^/]+)$/);
      url.pathname = m ? `/accounts/${m[1]}/content` : "/accounts";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ---- CREATOR: Content + Listen & Create; no paid marketing ----
  if (role === "creator") {
    if (PAID_APIS.some((a) => pathname.startsWith(a))) {
      return new NextResponse(JSON.stringify({ error: "Not permitted for your role" }), { status: 403, headers: { "Content-Type": "application/json" } });
    }
    const blockedPage =
      pathname === "/" ||
      pathname.startsWith("/reconciliation") ||
      pathname.startsWith("/onboard") ||
      pathname.startsWith("/settings") ||
      pathname.startsWith("/team") ||
      pathname === "/assistant" ||
      /^\/accounts\/[^/]+$/.test(pathname) ||        // paid-marketing account root
      /^\/accounts\/[^/]+\/google/.test(pathname) ||    // google analytics/ads tab
      /^\/accounts\/[^/]+\/settings/.test(pathname) ||  // account settings
      /^\/accounts\/[^/]+\/leads/.test(pathname) ||    // meta lead ads (agency only)
      /^\/accounts\/[^/]+\/inbox/.test(pathname) ||    // messaging inbox (agency only)
      /^\/accounts\/[^/]+\/assistant/.test(pathname);   // account assistant
    if (blockedPage) {
      const url = req.nextUrl.clone();
      // send them to the content view (of that account if we can tell)
      const m = pathname.match(/^\/accounts\/([^/]+)$/);
      url.pathname = m ? `/accounts/${m[1]}/content` : "/accounts";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
