import AppIcon from '../icons/AppIcon'
import './sidebar.css'

const sidebarItems = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { id: 'users', label: 'Users', icon: 'users' },
  { id: 'locations', label: 'Location', icon: 'location' },
  { id: 'devices', label: 'Devices', icon: 'devices' },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'settings',
    children: [
      { id: 'settings-basic', label: 'Basic Configuration' },
      { id: 'settings-advanced', label: 'Advanced Configuration' }
    ]
  },
  { id: 'location', label: 'Location Request', icon: 'location' },
  { id: 'commands', label: 'Commands', icon: 'command' },
  { id: 'replies', label: 'Replies', icon: 'replies' },
  { id: 'webhooks', label: 'Webhook Events', icon: 'refresh' }
]

export default function Sidebar({ activeSection, onChangeSection, onLogout }) {
  const isSettingsActive = activeSection.startsWith('settings')

  return (
    <aside className="sidebar-panel">
      <ul className="sidebar-nav">
        {sidebarItems.map((item) => (
          <li key={item.id}>
            <a
              className={activeSection === item.id || (item.id === 'settings' && isSettingsActive) ? 'active' : ''}
              href="#"
              onClick={(event) => {
                event.preventDefault()
                onChangeSection(item.id === 'settings' ? 'settings-basic' : item.id)
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
      <button className="logout-link" type="button" onClick={onLogout}>
        <AppIcon name="logout" className="nav-icon" />
        <span>Logout</span>
      </button>
    </aside>
  )
}
