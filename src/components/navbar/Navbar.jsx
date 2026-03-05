import './navbar.css'

export default function Navbar() {
  return (
    <header className="dashboard-topbar">
      <div className="brand">EV12 LOGO</div>
      <div className="profile">
        <div>
          <strong>Jane Doe</strong>
          <small>Admin</small>
        </div>
        <span className="avatar-dot" />
      </div>
    </header>
  )
}
