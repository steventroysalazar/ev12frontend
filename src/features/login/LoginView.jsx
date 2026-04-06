import QViewLogo from '../../components/branding/QViewLogo'
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
      <div className="auth-frame">
        <form
          className="auth-panel auth-form-card login-view"
          onSubmit={(event) => {
            event.preventDefault()
            onLogin()
          }}
        >
          <QViewLogo className="auth-brand-logo auth-logo-inline" />
          <h2>Welcome back</h2>
          <p className="auth-intro">Sign in to continue to your QView dashboard.</p>

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

        <div className="auth-panel auth-visual-panel">
          <div className="auth-visual-plant" aria-hidden="true" />
          <div className="auth-quote-card">
            <p className="auth-quote-eyebrow">QView Intelligence</p>
            <p>Proactive monitoring with a cleaner command center for high-stakes response teams.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
