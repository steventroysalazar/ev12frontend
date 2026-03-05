export default function LoginView({ loginForm, setLoginForm, onLogin, session }) {
  return (
    <section className="card auth-card">
      <h2>Sign in</h2>
      <p className="subtitle">Use your account credentials to access the Home dashboard.</p>
      
      <div className="field-grid">
        <input
          className="input-field"
          placeholder="Email"
          value={loginForm.email}
          onChange={(event) => setLoginForm((prev) => ({ ...prev, email: event.target.value }))}
        />
        <input
          className="input-field"
          placeholder="Password"
          type="password"
          value={loginForm.password}
          onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
        />
      </div>

      <button className="primary-action" onClick={onLogin}>Login</button>
      
      {session ? (
        <div className="status">
          <pre className="replies">{JSON.stringify(session, null, 2)}</pre>
        </div>
      ) : null}
    </section>
  );
}