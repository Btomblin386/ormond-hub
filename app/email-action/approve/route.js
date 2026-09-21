import { NextResponse } from "next/server";
import { FN, ANON } from "../fn";

// The ONLY place an email approval happens: the POST from the Approve button on
// /email-action. Link scanners follow GETs but don't submit forms, so a human
// has to press the button. (Public via middleware's "/email-action" prefix — the
// signed token is the credential.)
export const dynamic = "force-dynamic";

const back = (req, t, r) => {
  const u = new URL("/email-action", req.url);
  if (t) u.searchParams.set("t", t);
  if (r) u.searchParams.set("r", r);
  return NextResponse.redirect(u, 303);
};

export async function POST(req) {
  let t = "";
  try { t = String((await req.formData()).get("t") || ""); } catch {}
  if (!t) return back(req, "", null);
  try {
    const r = await fetch(FN, {
      method: "POST", cache: "no-store",
      headers: { Authorization: `Bearer ${ANON}`, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve_token", confirm: true, t }),
    });
    const d = await r.json();
    // The page re-peeks and renders the real state; r only picks the wording.
    return back(req, t, d.result === "approved" ? "approved" : d.result === "error" ? "error" : null);
  } catch { return back(req, t, "error"); }
}

// A GET here (scanner, refresh, pasted URL) never approves — back to the page.
export async function GET(req) {
  return back(req, new URL(req.url).searchParams.get("t") || "", null);
}
