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
      <div className="auth-layout-card auth-layout-card-login">
        <form
          className="card auth-form-card login-view"
          onSubmit={(event) => {
            event.preventDefault()
            onLogin()
          }}
        >
          <div className="auth-brand-lockup auth-brand-lockup-form">
            <QViewLogo className="auth-brand-logo" />
            <div>
              <p className="auth-eyebrow">Welcome back</p>
              <h2>Login</h2>
            </div>
          </div>

          <p className="auth-copy">Use your QView credentials to access your portal.</p>

          <label>Email Address</label>
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
            <span>secure</span>
          </div>

          <button className="auth-submit" type="submit" disabled={authLoading}>{authLoading ? 'Signing In...' : 'Sign In'}</button>
          {authStatus ? <p className={`auth-status auth-status-${statusTone(authStatus)}`}>{authStatus}</p> : null}
          <p className="auth-link" onClick={onGoRegister}>Need an account? Register</p>
          <p className="forgot-link">Forgot password?</p>
          {session ? <pre className="replies">{JSON.stringify(session, null, 2)}</pre> : null}
        </form>

        <aside className="auth-visual-panel" aria-label="QView brand section">
          <QViewLogo className="auth-visual-logo" title="QView" />
          <div className="auth-visual-glass">
            <p>QView monitoring tools, presented in one clean dashboard experience.</p>
          </div>
        </aside>
      </div>
    </section>
  )
}
