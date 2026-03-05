import './navbar.css'

export default function Navbar({ user }) {
  const firstName = user?.firstName || 'Jane'
  const lastName = user?.lastName || 'Doe'

  return (
    <header className="dashboard-topbar">
      <div className="brand">EV12 LOGO</div>
      <div className="profile">
        <div>
          <strong>{firstName} {lastName}</strong>
          <small>Admin</small>
        </div>
        <span className="avatar-dot" />
      </div>
    </header>
  )
}
