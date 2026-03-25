import QViewLogo from '../branding/QViewLogo'
import './navbar.css'

export default function Navbar({ user, alarmStreamConnected = false }) {
  const firstName = user?.firstName || 'Jane'
  const lastName = user?.lastName || 'Doe'

  return (
    <header className="dashboard-topbar">
      <div className="brand" aria-label="QView brand">
        <QViewLogo className="brand-logo" />
        <span>QView</span>
      </div>
      <div className="alarm-global-state">
        <span className={`stream-dot ${alarmStreamConnected ? 'is-online' : 'is-offline'}`} />
        <span className="stream-label">{alarmStreamConnected ? 'Live stream online' : 'Live stream reconnecting'}</span>
      </div>
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
