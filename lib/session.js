import { cookies } from "next/headers";
import { verifySession } from "./auth";

// Server-side session read for pages/route handlers.
export function getSession() {
  const c = cookies();
  const tok = c.get("hub_session")?.value;
  const s = tok ? verifySession(tok) : null;
  if (s) return s;
  if (c.get("hub_auth")?.value === process.env.DASHBOARD_PASSWORD) {
    return { role: "agency", name: "Agency", client_id: null };
  }
  return null;
}
