import { mediaUrlExists } from "../../../lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Public media proxy on our own (TikTok-verified) domain. TikTok's PULL_FROM_URL
// requires the video host be a verified domain; media actually lives on Supabase
// storage or a pasted CDN URL, so the publisher routes the pull through here.
//
// Not an open proxy: it only streams a URL that is referenced by a live content
// item (mediaUrlExists), and only https to a non-private host. Range requests are
// forwarded so TikTok/players can seek.

function isPrivateHost(host) {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) return true;
  // literal IPv4 in private / link-local / loopback ranges, and IPv6 loopback
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (h === "::1" || h === "[::1]") return true;
  return false;
}

async function handle(req, method) {
  const u = req.nextUrl.searchParams.get("u");
  if (!u) return new Response("missing u", { status: 400 });

  let target;
  try { target = new URL(u); } catch { return new Response("bad url", { status: 400 }); }
  if (target.protocol !== "https:" || isPrivateHost(target.hostname)) {
    return new Response("forbidden url", { status: 403 });
  }

  // Gate: only proxy media that a real content item references.
  let ok = false;
  try { ok = await mediaUrlExists(u); } catch { ok = false; }
  if (!ok) return new Response("not found", { status: 404 });

  const range = req.headers.get("range");
  const upstream = await fetch(u, {
    method,
    headers: range ? { Range: range } : {},
    redirect: "follow",
  });

  const headers = new Headers();
  for (const k of ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"]) {
    const v = upstream.headers.get(k);
    if (v) headers.set(k, v);
  }
  if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");
  // Do NOT let Vercel's CDN cache/normalize this — a cached full response served
  // against a Range request corrupts partial fetches (and the status).
  headers.set("cache-control", "no-store");

  // Preserve partial-content semantics: a Range that upstream honored must stay 206.
  const status = range && (upstream.status === 206 || upstream.headers.get("content-range")) ? 206 : upstream.status;

  return new Response(method === "HEAD" ? null : upstream.body, { status, headers });
}

export async function GET(req) { return handle(req, "GET"); }
export async function HEAD(req) { return handle(req, "HEAD"); }
