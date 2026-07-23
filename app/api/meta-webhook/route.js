import { NextResponse } from "next/server";
import { logMetaWebhookEvent } from "../../../lib/db";

export const dynamic = "force-dynamic";

// Meta Messenger Platform webhook endpoint.
// GET  = Meta's one-time verification handshake (echo hub.challenge).
// POST = message/event deliveries; stored raw in meta_webhook_events (these will
//        later drive a real-time inbox — for now receipt is what App Review needs).
// The verify token is only used during the dashboard handshake — it gates
// registration, not data access.
const VERIFY_TOKEN = "ormondhub-meta-webhook-8f3k2m9x";

export async function GET(req) {
  const q = req.nextUrl.searchParams;
  if (q.get("hub.mode") === "subscribe" && q.get("hub.verify_token") === VERIFY_TOKEN) {
    return new Response(q.get("hub.challenge") || "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("verification failed", { status: 403 });
}

export async function POST(req) {
  try {
    const body = await req.json();
    // Respond 200 fast — Meta retries and eventually disables slow/failing webhooks.
    logMetaWebhookEvent(body?.object || null, body).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // never make Meta retry-storm us over a parse error
  }
}
