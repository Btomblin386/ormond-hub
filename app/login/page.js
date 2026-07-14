export default function Login({ searchParams }) {
  const err = searchParams?.e;
  return (
    <form className="login-box" method="POST" action="/api/login">
      <h1>Ormond Hub</h1>
      <p>Sign in to continue.</p>
      {err ? <div className="err">Incorrect email or password.</div> : null}
      <input type="email" name="email" placeholder="Email (leave blank for agency password)" autoComplete="username" />
      <input type="password" name="password" placeholder="Password" autoFocus autoComplete="current-password" />
      <button type="submit">Sign in</button>
    </form>
  );
}
