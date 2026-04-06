import { useState } from 'react'
import QViewLogo from '../../components/branding/QViewLogo'
import './register.css'

const roleOptions = [
  { label: 'Super Admin', value: 1 },
  { label: 'Manager', value: 2 },
  { label: 'User', value: 3 }
]

export default function RegisterView({ registerForm, setRegisterForm, onRegister, onGoLogin }) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <section className="auth-shell">
      <div className="auth-layout-card auth-layout-card-register">
        <div className="card auth-form-card register-view">
          <div className="auth-brand-lockup auth-brand-lockup-form">
            <QViewLogo className="auth-brand-logo" />
            <div>
              <p className="auth-eyebrow">Create your account</p>
              <h2>Register</h2>
            </div>
          </div>

          <div className="form-row two-col">
            <div>
              <label>First Name</label>
              <input
                placeholder="First Name"
                value={registerForm.firstName}
                onChange={(event) => setRegisterForm((prev) => ({ ...prev, firstName: event.target.value }))}
              />
            </div>
            <div>
              <label>Last Name</label>
              <input
                placeholder="Last Name"
                value={registerForm.lastName}
                onChange={(event) => setRegisterForm((prev) => ({ ...prev, lastName: event.target.value }))}
              />
            </div>
          </div>

          <div className="form-row two-col">
            <div>
              <label>Email Address</label>
              <input
                placeholder="johndoe_123@example.com"
                value={registerForm.email}
                onChange={(event) => setRegisterForm((prev) => ({ ...prev, email: event.target.value }))}
              />
            </div>
            <div>
              <label>Password</label>
              <div className="password-field">
                <input
                  placeholder="••••••••••••"
                  type={showPassword ? 'text' : 'password'}
                  value={registerForm.password}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, password: event.target.value }))}
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
            </div>
          </div>

          <div className="form-row two-col">
            <div>
              <label>Address</label>
              <input
                placeholder="Complete Address"
                value={registerForm.address}
                onChange={(event) => setRegisterForm((prev) => ({ ...prev, address: event.target.value }))}
              />
            </div>
            <div>
              <label>Contact Number</label>
              <input
                placeholder="09987654321"
                value={registerForm.contactNumber}
                onChange={(event) => setRegisterForm((prev) => ({ ...prev, contactNumber: event.target.value }))}
              />
            </div>
          </div>

          <div className="form-row two-col role-row">
            <div>
              <label>Location <span className="optional">(Optional)</span></label>
              <input
                placeholder="Location"
                value={registerForm.locationId}
                onChange={(event) => setRegisterForm((prev) => ({ ...prev, locationId: event.target.value }))}
              />
            </div>
            <div>
              <label>Role</label>
              <select value={registerForm.userRole} onChange={(event) => setRegisterForm((prev) => ({ ...prev, userRole: Number(event.target.value) }))}>
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <label>Manager</label>
          <input
            placeholder="Manager"
            value={registerForm.managerId}
            onChange={(event) => setRegisterForm((prev) => ({ ...prev, managerId: event.target.value }))}
          />

          <button className="auth-submit" onClick={onRegister}>Create Account</button>
          <p className="auth-link" onClick={onGoLogin}>Already have an account? Login</p>
        </div>

        <aside className="auth-visual-panel" aria-label="QView brand section">
          <QViewLogo className="auth-visual-logo" title="QView" />
          <div className="auth-visual-glass">
            <p>Deploy faster with a calm, professional interface designed around focus.</p>
          </div>
        </aside>
      </div>
    </section>
  )
}
