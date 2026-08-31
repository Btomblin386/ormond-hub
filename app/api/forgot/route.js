import { NextResponse } from "next/server";
import { userByEmail } from "../../../lib/db";
import { sendResetEmail } from "../../../lib/pwreset";

export const dynamic = "force-dynamic";

// Public "forgot password" endpoint. Always answers ok so it can't be used
// to probe which emails have logins; the email only goes out when one does.
export async function POST(req) {
  try {
    const b = await req.json();
    const email = String(b.email || "").trim();
    if (email) {
      const u = await userByEmail(email); // active users only
      if (u?.email) await sendResetEmail(u, new URL(req.url).origin).catch(() => {});
    }
  } catch { /* generic response regardless */ }
  return NextResponse.json({ ok: true });
}
