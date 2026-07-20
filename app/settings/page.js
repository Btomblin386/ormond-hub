import { notFound } from "next/navigation";
import Shell from "../../components/Shell";
import TeamManager from "../../components/TeamManager";
import DropboxFolderControl from "../../components/DropboxFolderControl";
import CredentialsPanel from "../../components/CredentialsPanel";
import { getSession } from "../../lib/session";
import { listUsers, clientsList, connectionsOverview } from "../../lib/db";

export const dynamic = "force-dynamic";

const STATUS_FN = "https://jxlrnuyfracyygiksqdj.supabase.co/functions/v1/config-status";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4bHJudXlmcmFjeXlnaWtzcWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjQ1OTUsImV4cCI6MjA5MDIwMDU5NX0.std1mTdOV4bU4S7wygQ67NdganwPrI6b2HFBi1BXQJ8";

// [env key, label, where it lives, what it powers, how to update]
const SUPA_SECRET = (name) => [
  `Supabase → Project jxlrnuyfracyygiksqdj → Edge Functions → Secrets.`,
  `Add or edit the secret named ${name} and save.`,
  `Edge functions pick it up on their next invocation — no redeploy needed.`,
];
const VERCEL_ENV = (name) => [
  `Vercel → ormond-hub → Settings → Environment Variables.`,
  `Set ${name} for Production (and Preview if you use it).`,
  `Redeploy for the change to take effect (Deployments → ⋯ → Redeploy).`,
];
const CREDS = [
  ["ANTHROPIC_API_KEY", "Anthropic API key", "Supabase secrets", "chat, insights, campaign plans, assistant, summaries", SUPA_SECRET("ANTHROPIC_API_KEY")],
  ["META_ACCESS_TOKEN", "Meta system-user token", "Supabase secrets", "ads data, publishing, AND all Facebook/Instagram brand listening", [
    "Get a long-lived System User token in Meta Business Settings → Users → System Users (needs pages_read_engagement, pages_manage_posts, instagram_basic, instagram_manage_insights, ads_management).",
    ...SUPA_SECRET("META_ACCESS_TOKEN"),
  ]],
  ["META_APP_SECRET", "Meta app secret", "Supabase secrets", "Facebook Login onboarding", SUPA_SECRET("META_APP_SECRET")],
  ["GA4_SA_JSON", "GA4 service-account JSON", "Supabase secrets", "legacy GA4 ingest (Slavens)", SUPA_SECRET("GA4_SA_JSON")],
  ["GOOGLE_OAUTH_CLIENT_ID", "Google OAuth client ID", "Supabase secrets + Vercel env", "Connect with Google", [...SUPA_SECRET("GOOGLE_OAUTH_CLIENT_ID"), "Also set the same value in " + VERCEL_ENV("GOOGLE_OAUTH_CLIENT_ID")[0]]],
  ["GOOGLE_OAUTH_CLIENT_SECRET", "Google OAuth client secret", "Supabase secrets", "Connect with Google", SUPA_SECRET("GOOGLE_OAUTH_CLIENT_SECRET")],
  ["DROPBOX_APP_KEY", "Dropbox app key", "Supabase secrets + Vercel env", "Dropbox picker", [...SUPA_SECRET("DROPBOX_APP_KEY"), "Also set the same value in " + VERCEL_ENV("DROPBOX_APP_KEY")[0]]],
  ["DROPBOX_APP_SECRET", "Dropbox app secret", "Supabase secrets", "Dropbox picker", SUPA_SECRET("DROPBOX_APP_SECRET")],
  ["DASHBOARD_PASSWORD", "Dashboard password / session key", "Vercel env", "the agency login AND the key that signs every user session — the whole app is locked without it", VERCEL_ENV("DASHBOARD_PASSWORD")],
];

export default async function SettingsPage() {
  const s = getSession();
  if (s?.role !== "agency") notFound();

  let status = {};
  try {
    const r = await fetch(STATUS_FN, { headers: { Authorization: `Bearer ${ANON}` }, cache: "no-store" });
    status = (await r.json()).status || {};
  } catch { /* checklist shows unknown */ }

  const [users, clients, conn] = await Promise.all([
    listUsers().catch(() => []),
    clientsList().catch(() => []),
    connectionsOverview().catch(() => ({})),
  ]);

  return (
    <Shell crumb={<><b>Settings</b></>}>
      <h1>Settings</h1>
      <div className="sub">Platform connections, credentials, and team access — brand-specific settings live on each account&apos;s Settings tab</div>

      <div className="panel">
        <h2>Connections</h2>
        <p className="note">Agency-wide integrations. Connecting here (or on the onboarding page) makes them available to every brand.</p>
        <div className="set-conn">
          <span className={conn?.fb_pages ? "social-ok" : "muted"}>{conn?.fb_pages ? "✓" : "○"}</span>
          <span className="set-conn-name">Facebook / Instagram</span>
          <span className="muted" style={{ fontSize: 12 }}>{conn?.fb_pages || 0} Page{conn?.fb_pages === 1 ? "" : "s"} connected</span>
          <a className="social-btn" style={{ marginLeft: "auto", textDecoration: "none" }} href="/onboard">Connect Pages</a>
        </div>
        <div className="set-conn">
          <span className={conn?.ga4_properties ? "social-ok" : "muted"}>{conn?.ga4_properties ? "✓" : "○"}</span>
          <span className="set-conn-name">Google Analytics &amp; Ads</span>
          <span className="muted" style={{ fontSize: 12 }}>{conn?.ga4_properties || 0} GA4 propert{conn?.ga4_properties === 1 ? "y" : "ies"}{conn?.google_emails?.length ? ` · ${conn.google_emails.join(", ")}` : ""}</span>
          <a className="social-btn" style={{ marginLeft: "auto", textDecoration: "none" }} href="/api/oauth/google/start">Connect Google</a>
        </div>
        <div className="set-conn">
          <span className={conn?.dropbox_email ? "social-ok" : "muted"}>{conn?.dropbox_email ? "✓" : "○"}</span>
          <span className="set-conn-name">Dropbox</span>
          <span className="muted" style={{ fontSize: 12 }}>{conn?.dropbox_email ? `${conn.dropbox_email} · set each brand's default folder in its Settings tab or from the picker` : "not connected"}</span>
          <a className="social-btn" style={{ marginLeft: "auto", textDecoration: "none" }} href="/api/oauth/dropbox/start">{conn?.dropbox_email ? "Reconnect" : "Connect Dropbox"}</a>
        </div>
        {conn?.dropbox_email && <DropboxFolderControl />}
      </div>

      <div className="panel">
        <h2>Platform credentials</h2>
        <p className="note">Values live in Supabase Edge Function secrets and Vercel environment variables, never in the app database — that keeps secrets out of anything the browser can reach. Click <b>How to update</b> on any row for the exact steps. A self-serve in-app key editor arrives with the multi-tenant version.</p>
        <CredentialsPanel creds={CREDS} status={status} />
      </div>

      <div className="panel" id="team">
        <h2>Team &amp; access</h2>
        <p className="note">Create logins and set what each person can see. Agency = everything · Creator = Content + Listen &amp; Create · Client = their brand&apos;s Content only.</p>
        <TeamManager users={users} clients={clients} />
      </div>
    </Shell>
  );
}
