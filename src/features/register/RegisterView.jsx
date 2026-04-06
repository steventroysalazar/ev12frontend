import QViewLogo from '../../components/branding/QViewLogo'
import './register.css'

const roleOptions = [
  { label: 'Super Admin', value: 1 },
  { label: 'Manager', value: 2 },
  { label: 'User', value: 3 }
]

export default function RegisterView({ registerForm, setRegisterForm, onRegister, onGoLogin }) {
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
                  type="password"
                  value={registerForm.password}
                  onChange={(event) => setRegisterForm((prev) => ({ ...prev, password: event.target.value }))}
                />
                <span>secure</span>
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
