import { NextResponse } from "next/server";
import { saveChatExchange, clearChat } from "../../../lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Proxies the chat to the Supabase edge function, which holds the Anthropic key.
// Also persists the conversation per client so it survives navigation — the
// account page loads history server-side and passes it back in as context.
const FN_URL = "https://jxlrnuyfracyygiksqdj.supabase.co/functions/v1/account-chat";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4bHJudXlmcmFjeXlnaWtzcWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjQ1OTUsImV4cCI6MjA5MDIwMDU5NX0.std1mTdOV4bU4S7wygQ67NdganwPrI6b2HFBi1BXQJ8";

export async function POST(req) {
  try {
    const body = await req.json();

    if (body.op === "clear") {
      if (!body.clientId) return NextResponse.json({ error: "clientId required" }, { status: 400 });
      await clearChat(body.clientId);
      return NextResponse.json({ ok: true });
    }

    const resp = await fetch(FN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}` },
      body: JSON.stringify({ client: body.client, messages: body.messages }),
    });
    const data = await resp.json();

    // Persist only successful exchanges; a failed call shouldn't pollute history.
    if (resp.ok && data.reply && body.clientId) {
      const lastUser = [...(body.messages || [])].reverse().find((m) => m.role === "user");
      if (lastUser?.content) {
        try { await saveChatExchange(body.clientId, lastUser.content, data.reply); } catch { /* history is best-effort */ }
      }
    }
    return NextResponse.json(data, { status: resp.status });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
