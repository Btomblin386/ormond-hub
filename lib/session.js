import { cookies } from "next/headers";
import { verifySession } from "./auth";

// Server-side session read for pages/route handlers.
export function getSession() {
  const c = cookies();
  const tok = c.get("hub_session")?.value;
  const s = tok ? verifySession(tok) : null;
  if (s) return s;
  // Both sides must be non-empty: a missing DASHBOARD_PASSWORD env var must
  // never match a missing cookie (that once granted anonymous agency access).
  const secret = process.env.DASHBOARD_PASSWORD || "";
  const legacy = c.get("hub_auth")?.value;
  if (secret && legacy && legacy === secret) {
    return { role: "agency", name: "Agency", client_id: null };
  }
  return null;
}
