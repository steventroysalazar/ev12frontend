import './navbar.css'

export default function Navbar({ user, activeAlarmCount = 0, alarmStreamConnected = false }) {
  const firstName = user?.firstName || 'Jane'
  const lastName = user?.lastName || 'Doe'

  return (
    <header className="dashboard-topbar">
      <div className="brand">EV12 LOGO</div>
      <div className="alarm-global-state">
        <span className={`stream-dot ${alarmStreamConnected ? 'is-online' : 'is-offline'}`} />
        <span className="stream-label">{alarmStreamConnected ? 'Live stream online' : 'Live stream reconnecting'}</span>
        <span className={`alarm-count-pill ${activeAlarmCount > 0 ? 'has-alert' : ''}`}>
          Active alarms: {activeAlarmCount}
        </span>
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
