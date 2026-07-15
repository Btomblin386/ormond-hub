import { notFound } from "next/navigation";
import Shell from "../../components/Shell";
import TeamManager from "../../components/TeamManager";
import DropboxFolderControl from "../../components/DropboxFolderControl";
import { getSession } from "../../lib/session";
import { listUsers, clientsList, connectionsOverview } from "../../lib/db";

export const dynamic = "force-dynamic";

const STATUS_FN = "https://jxlrnuyfracyygiksqdj.supabase.co/functions/v1/config-status";
const ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp4bHJudXlmcmFjeXlnaWtzcWRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MjQ1OTUsImV4cCI6MjA5MDIwMDU5NX0.std1mTdOV4bU4S7wygQ67NdganwPrI6b2HFBi1BXQJ8";

// [env key, label, where it lives, what breaks without it]
const CREDS = [
  ["ANTHROPIC_API_KEY", "Anthropic API key", "Supabase secrets", "chat, insights, campaign plans, assistant, summaries"],
  ["META_ACCESS_TOKEN", "Meta system-user token", "Supabase secrets", "ads data, publishing, listening"],
  ["META_APP_SECRET", "Meta app secret", "Supabase secrets", "Facebook Login onboarding"],
  ["GA4_SA_JSON", "GA4 service-account JSON", "Supabase secrets", "legacy GA4 ingest (Slavens)"],
  ["GOOGLE_OAUTH_CLIENT_ID", "Google OAuth client ID", "Supabase secrets + Vercel env", "Connect with Google"],
  ["GOOGLE_OAUTH_CLIENT_SECRET", "Google OAuth client secret", "Supabase secrets", "Connect with Google"],
  ["DROPBOX_APP_KEY", "Dropbox app key", "Supabase secrets + Vercel env", "Dropbox picker"],
  ["DROPBOX_APP_SECRET", "Dropbox app secret", "Supabase secrets", "Dropbox picker"],
  ["BRAND_LISTENER_API_KEY", "Brand listener API key", "Supabase secrets", "optional listening providers"],
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
        <p className="note">Status only — values are stored in Supabase Edge Function secrets and Vercel environment variables, never in the app database. A self-serve key editor is planned for the multi-tenant version.</p>
        <table>
          <thead><tr><th></th><th>Credential</th><th>Lives in</th><th>Powers</th></tr></thead>
          <tbody>
            {CREDS.map(([key, label, where, powers]) => (
              <tr key={key}>
                <td>{status[key] === true ? <span className="social-ok">✓</span> : status[key] === false ? <span className="cred-missing">✗</span> : <span className="muted">?</span>}</td>
                <td><b>{label}</b><div className="muted" style={{ fontSize: 11 }}>{key}</div></td>
                <td style={{ fontSize: 12.5 }}>{where}</td>
                <td style={{ fontSize: 12.5 }}>{powers}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel" id="team">
        <h2>Team &amp; access</h2>
        <p className="note">Create logins and set what each person can see. Agency = everything · Creator = Content + Listen &amp; Create · Client = their brand&apos;s Content only.</p>
        <TeamManager users={users} clients={clients} />
      </div>
    </Shell>
  );
}
