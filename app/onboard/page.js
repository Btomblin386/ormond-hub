import { cookies } from "next/headers";
import Shell from "../../components/Shell";
import OnboardClient from "../../components/OnboardClient";
import OnboardGoogle from "../../components/OnboardGoogle";
import { clientsList } from "../../lib/db";

export const dynamic = "force-dynamic";

const FB_FN_URL = "https://jxlrnuyfracyygiksqdj.supabase.co/functions/v1/oauth-facebook";
const G_FN_URL = "https://jxlrnuyfracyygiksqdj.supabase.co/functions/v1/oauth-google";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4bHJudXlmcmFjeXlnaWtzcWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjQ1OTUsImV4cCI6MjA5MDIwMDU5NX0.std1mTdOV4bU4S7wygQ67NdganwPrI6b2HFBi1BXQJ8";

async function fnPost(url, body) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ANON}` },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return r.json();
}

export default async function Onboard({ searchParams }) {
  const fbSession = cookies().get("fb_onboard_session")?.value;
  const gSession = cookies().get("g_onboard_session")?.value;
  const error = searchParams?.error;

  let pages = null, fbError = null;
  if (fbSession) {
    try {
      const d = await fnPost(FB_FN_URL, { action: "list", session: fbSession });
      if (d.error) fbError = d.error; else pages = d.pages || [];
    } catch (e) { fbError = String(e); }
  }

  let gProps = null, gError = null, gEmail = null;
  if (gSession) {
    try {
      const d = await fnPost(G_FN_URL, { action: "list", session: gSession });
      if (d.error) gError = d.error; else { gProps = d.properties || []; gEmail = d.email; }
    } catch (e) { gError = String(e); }
  }

  const clients = await clientsList();

  return (
    <Shell crumb={<><b>Onboarding</b> · connect accounts</>}>
      <h1>Connect accounts</h1>
      <div className="sub">Facebook/Instagram for content &amp; listening · Google for GA4 analytics (and Google Ads, once approved).</div>

      {error && <div className="err-box">Error: {error}</div>}

      {!fbSession ? (
        <div className="panel">
          <h2>Connect with Facebook</h2>
          <p className="note">You&apos;ll be sent to Facebook to log in and approve access. Come back here to choose which Pages to onboard. Nothing is imported until you select it.</p>
          <a className="cmp-btn solid" style={{ display: "inline-block", textDecoration: "none" }} href="/api/oauth/facebook/start">Continue with Facebook</a>
        </div>
      ) : fbError ? (
        <div className="panel">
          <div className="err-box">Couldn&apos;t load your Pages: {fbError}</div>
          <a className="cmp-btn outline" style={{ display: "inline-block", textDecoration: "none", marginTop: 10 }} href="/api/oauth/facebook/start">Reconnect Facebook</a>
        </div>
      ) : (
        <OnboardClient pages={pages || []} clients={clients} />
      )}

      {!gSession ? (
        <div className="panel">
          <h2>Connect with Google</h2>
          <p className="note">Grants read access to GA4 (reconciliation, product insights, seasonality) and Google Ads. You pick which properties to bring in — nothing is imported until you select it.</p>
          <a className="cmp-btn solid" style={{ display: "inline-block", textDecoration: "none" }} href="/api/oauth/google/start">Continue with Google</a>
        </div>
      ) : gError ? (
        <div className="panel">
          <div className="err-box">Couldn&apos;t load your GA4 properties: {gError}</div>
          <a className="cmp-btn outline" style={{ display: "inline-block", textDecoration: "none", marginTop: 10 }} href="/api/oauth/google/start">Reconnect Google</a>
        </div>
      ) : (
        <OnboardGoogle properties={gProps || []} clients={clients} email={gEmail} />
      )}
    </Shell>
  );
}
