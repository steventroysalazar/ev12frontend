import AppIcon from '../icons/AppIcon'
import './sidebar.css'

const operationsGroup = {
  id: 'operations',
  label: 'Operations',
  items: [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'users', label: 'Users', icon: 'users' },
    { id: 'locations', label: 'Locations', icon: 'location' },
    { id: 'devices', label: 'Devices', icon: 'devices' },
    { id: 'alarm-logs', label: 'Alarm Logs', icon: 'clock' },
    { id: 'replies', label: 'Replies', icon: 'replies' },
    { id: 'webhooks', label: 'Webhook Events', icon: 'refresh' }
  ]
}

const deviceCenterGroup = {
  id: 'device-center',
  label: 'Device Center',
  items: [
    { id: 'device-detail-overview', label: 'Device Profile', icon: 'devices' },
    {
      id: 'device-detail-settings',
      label: 'Settings',
      icon: 'settings',
      children: [
        { id: 'device-detail-basic', label: 'Basic Configuration' },
        { id: 'device-detail-advanced', label: 'Advanced Configuration' }
      ]
    },
    { id: 'device-detail-location', label: 'Location Request', icon: 'location' },
    { id: 'device-detail-commands', label: 'Commands', icon: 'command' }
  ]
}

export default function Sidebar({ activeSection, onChangeSection, onLogout, showDeviceCenter = false }) {
  const isSettingsActive = activeSection.startsWith('device-detail-') || activeSection.startsWith('settings')
  const sidebarGroups = showDeviceCenter ? [operationsGroup, deviceCenterGroup] : [operationsGroup]

  return (
    <aside className="sidebar-panel">
      <div className="sidebar-scroll">
        {sidebarGroups.map((group) => (
          <div key={group.id} className="sidebar-group">
            <p className="sidebar-group-title">{group.label}</p>
            <ul className="sidebar-nav">
              {group.items.map((item) => (
                <li key={item.id}>
                  <a
                    className={activeSection === item.id || (item.id === 'device-detail-settings' && isSettingsActive) ? 'active' : ''}
                    href="#"
                    onClick={(event) => {
                      event.preventDefault()
                      onChangeSection(item.id === 'device-detail-settings' ? 'device-detail-basic' : item.id)
                    }}
                  >
                    <AppIcon name={item.icon} className="nav-icon" />
                    <span>{item.label}</span>
                  </a>

                  {item.children ? (
                    <ul className="sidebar-subnav">
                      {item.children.map((child) => (
                        <li key={child.id}>
                          <a
                            className={activeSection === child.id ? 'sub-active' : ''}
                            href="#"
                            onClick={(event) => {
                              event.preventDefault()
                              onChangeSection(child.id)
                            }}
                          >
                            {child.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <button className="logout-link" type="button" onClick={onLogout}>
        <AppIcon name="logout" className="nav-icon" />
        <span>Logout</span>
      </button>
    </aside>
  )
}
