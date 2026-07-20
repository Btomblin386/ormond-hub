export default function Login({ searchParams }) {
  const err = searchParams?.e;
  return (
    <form className="login-box" method="POST" action="/api/login">
      <h1>Ormond Hub</h1>
      <p>Sign in to continue.</p>
      {err === "cfg"
        ? <div className="err">Server is missing its DASHBOARD_PASSWORD environment variable — sign-in is disabled until it&apos;s set in Vercel and redeployed.</div>
        : err ? <div className="err">Incorrect email or password.</div> : null}
      <input type="email" name="email" placeholder="Email" autoComplete="username" required />
      <input type="password" name="password" placeholder="Password" autoFocus autoComplete="current-password" required />
      <button type="submit">Sign in</button>
    </form>
  );
}
