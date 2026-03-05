const roleOptions = [
  { label: 'Super Admin', value: 1 },
  { label: 'Manager', value: 2 },
  { label: 'User', value: 3 }
]

export default function RegisterView({ registerForm, setRegisterForm, onRegister }) {
  return (
    <section className="card auth-card">
      <h2>Create account</h2>
      <p className="subtitle">Register a new user profile before accessing the Home dashboard.</p>
      <input
        placeholder="Email"
        value={registerForm.email}
        onChange={(event) => setRegisterForm((prev) => ({ ...prev, email: event.target.value }))}
      />
      <input
        placeholder="Password"
        type="password"
        value={registerForm.password}
        onChange={(event) => setRegisterForm((prev) => ({ ...prev, password: event.target.value }))}
      />
      <input
        placeholder="First name"
        value={registerForm.firstName}
        onChange={(event) => setRegisterForm((prev) => ({ ...prev, firstName: event.target.value }))}
      />
      <input
        placeholder="Last name"
        value={registerForm.lastName}
        onChange={(event) => setRegisterForm((prev) => ({ ...prev, lastName: event.target.value }))}
      />
      <input
        placeholder="Contact number"
        value={registerForm.contactNumber}
        onChange={(event) => setRegisterForm((prev) => ({ ...prev, contactNumber: event.target.value }))}
      />
      <input
        placeholder="Address"
        value={registerForm.address}
        onChange={(event) => setRegisterForm((prev) => ({ ...prev, address: event.target.value }))}
      />
      <label>User role</label>
      <select value={registerForm.userRole} onChange={(event) => setRegisterForm((prev) => ({ ...prev, userRole: Number(event.target.value) }))}>
        {roleOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button onClick={onRegister}>Register</button>
    </section>
  )
}
