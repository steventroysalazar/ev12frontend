import './sidebar.css'

const sidebarItems = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'users', label: 'Users' },
  { id: 'locations', label: 'Locations' },
  { id: 'devices', label: 'Devices' },
  {
    id: 'settings',
    label: 'Settings',
    children: [
      { id: 'settings-basic', label: 'Basic Configuration' },
      { id: 'settings-alarm', label: 'Alarm Settings' }
    ]
  },
  { id: 'location', label: 'Location' },
  { id: 'commands', label: 'Commands' },
  { id: 'replies', label: 'Replies' }
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
              {item.label}
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
      <button className="logout-link" type="button" onClick={onLogout}>Logout</button>
    </aside>
  )
}
