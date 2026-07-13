export default function Login({ searchParams }) {
  const err = searchParams?.e;
  return (
    <form className="login-box" method="POST" action="/api/login">
      <h1>Ormond Hub</h1>
      <p>Enter the access password.</p>
      {err ? <div className="err">Incorrect password.</div> : null}
      <input
        type="password"
        name="password"
        placeholder="Password"
        autoFocus
        autoComplete="current-password"
      />
      <button type="submit">Enter</button>
    </form>
  );
}
