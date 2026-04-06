import { useState } from 'react'
import QViewLogo from '../../components/branding/QViewLogo'
import './login.css'

const statusTone = (status) => {
  const message = String(status || '').toLowerCase()
  if (message.includes('failed') || message.includes('validation')) return 'error'
  if (message.includes('logged in')) return 'success'
  return 'info'
}

export default function LoginView({ loginForm, setLoginForm, onLogin, session, onGoRegister, authStatus, authLoading }) {
  const [showPassword, setShowPassword] = useState(false)

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
              type={showPassword ? 'text' : 'password'}
              value={loginForm.password}
              onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((prev) => !prev)}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M3 4.5 19.5 21M10.5 10.8a2.3 2.3 0 0 0 3.1 3.1M8.2 6.9A12.8 12.8 0 0 1 12 6.3c4.9 0 8.8 2.9 10 5.7a10.9 10.9 0 0 1-4.1 4.8M5.6 9.4A11.2 11.2 0 0 0 2 12c1.2 2.8 5.1 5.7 10 5.7 1.1 0 2.2-.2 3.1-.5" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
                  <circle cx="12" cy="12" r="3.2" />
                </svg>
              )}
            </button>
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
