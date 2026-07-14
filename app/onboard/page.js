import { cookies } from "next/headers";
import Shell from "../../components/Shell";
import OnboardClient from "../../components/OnboardClient";
import { clientsList } from "../../lib/db";

export const dynamic = "force-dynamic";

const FN_URL = "https://jxlrnuyfracyygiksqdj.supabase.co/functions/v1/oauth-facebook";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4bHJudXlmcmFjeXlnaWtzcWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjQ1OTUsImV4cCI6MjA5MDIwMDU5NX0.std1mTdOV4bU4S7wygQ67NdganwPrI6b2HFBi1BXQJ8";

export default async function Onboard({ searchParams }) {
  const session = cookies().get("fb_onboard_session")?.value;
  const error = searchParams?.error;

  let pages = null;
  let listError = null;
  if (session) {
    try {
      const r = await fetch(FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}` },
        body: JSON.stringify({ action: "list", session }),
        cache: "no-store",
      });
      const d = await r.json();
      if (d.error) listError = d.error; else pages = d.pages || [];
    } catch (e) { listError = String(e); }
  }

  const clients = await clientsList();

  return (
    <Shell crumb={<><b>Onboarding</b> · connect accounts</>}>
      <h1>Connect social accounts</h1>
      <div className="sub">Log in with Facebook, then pick the Pages and Instagram accounts to bring into the hub.</div>

      {error && <div className="err-box">Error: {error}</div>}

      {!session ? (
        <div className="panel">
          <h2>Connect with Facebook</h2>
          <p className="note">You&apos;ll be sent to Facebook to log in and approve access. Come back here to choose which Pages to onboard. Nothing is imported until you select it.</p>
          <a className="cmp-btn solid" style={{ display: "inline-block", textDecoration: "none" }} href="/api/oauth/facebook/start">Continue with Facebook</a>
        </div>
      ) : listError ? (
        <div className="panel">
          <div className="err-box">Couldn&apos;t load your Pages: {listError}</div>
          <a className="cmp-btn outline" style={{ display: "inline-block", textDecoration: "none", marginTop: 10 }} href="/api/oauth/facebook/start">Reconnect Facebook</a>
        </div>
      ) : (
        <OnboardClient pages={pages || []} clients={clients} />
      )}
    </Shell>
  );
}
