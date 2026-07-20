// Break-glass agency login: the shared DASHBOARD_PASSWORD (no email). Kept on a
// separate, unlinked URL so normal users never see it as an option on /login.
// The API only honors the shared-password path when it carries the master flag
// this form sets.
export default function AgencyMasterLogin({ searchParams }) {
  const err = searchParams?.e;
  return (
    <form className="login-box" method="POST" action="/api/login">
      <h1>Ormond Hub</h1>
      <p>Agency master access.</p>
      {err === "cfg"
        ? <div className="err">Server is missing its DASHBOARD_PASSWORD environment variable — set it in Vercel and redeploy.</div>
        : err ? <div className="err">Incorrect agency password.</div> : null}
      <input type="hidden" name="agency_master" value="1" />
      <input type="password" name="password" placeholder="Agency password" autoFocus autoComplete="current-password" required />
      <button type="submit">Sign in</button>
      <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>Break-glass login. Day to day, use your own account at <a href="/login">/login</a>.</p>
    </form>
  );
}
