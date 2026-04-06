import QViewLogo from '../branding/QViewLogo'
import './navbar.css'

export default function Navbar({ user, alarmStreamConnected = false }) {
  const firstName = user?.firstName || 'Jane'
  const lastName = user?.lastName || 'Doe'
  const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase()

  return (
    <header className="dashboard-topbar">
      <div className="brand" aria-label="QView brand">
        <QViewLogo className="brand-logo" />
        <div>
          <span>QView</span>
          <small>Workspace</small>
        </div>
      </div>
      <div className="alarm-global-state" aria-live="polite">
        <span className={`stream-dot ${alarmStreamConnected ? 'is-online' : 'is-offline'}`} aria-hidden="true" />
        <span className="stream-label">{alarmStreamConnected ? 'Live online' : 'Reconnecting'}</span>
      </div>
      <div className="profile">
        <div>
          <strong>{firstName} {lastName}</strong>
          <small>Admin</small>
        </div>
        <span className="avatar-dot" aria-hidden="true">{initials}</span>
      </div>
    </header>
  )
}
