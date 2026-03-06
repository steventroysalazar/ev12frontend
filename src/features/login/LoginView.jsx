import './login.css'

const statusTone = (status) => {
  const message = String(status || '').toLowerCase()
  if (message.includes('failed') || message.includes('validation')) return 'error'
  if (message.includes('logged in')) return 'success'
  return 'info'
}

export default function LoginView({ loginForm, setLoginForm, onLogin, session, onGoRegister, authStatus, authLoading }) {
  return (
    <section className="auth-shell">
      <div className="auth-brand-panel">
        <h1>EV12 PORTAL</h1>
        <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
      </div>

      <form
        className="card auth-form-card login-view"
        onSubmit={(event) => {
          event.preventDefault()
          onLogin()
        }}
      >
        <h2>Login</h2>
        <label>Email</label>
        <input
          placeholder="johndoe_123@example.com"
          value={loginForm.email}
          onChange={(event) => setLoginForm((prev) => ({ ...prev, email: event.target.value }))}
        />

        <label>Password</label>
        <div className="password-field">
          <input
            placeholder="••••••••••••"
            type="password"
            value={loginForm.password}
            onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
          />
          <span>show</span>
        </div>

        <button className="auth-submit" type="submit" disabled={authLoading}>{authLoading ? 'Signing In...' : 'Sign In'}</button>
        {authStatus ? <p className={`auth-status auth-status-${statusTone(authStatus)}`}>{authStatus}</p> : null}
        <p className="auth-link" onClick={onGoRegister}>Need an account? Register</p>
        <p className="forgot-link">Forgot password?</p>
        {session ? <pre className="replies">{JSON.stringify(session, null, 2)}</pre> : null}
      </form>
    </section>
  )
}
