import './sidebar.css'

const sidebarItems = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'users', label: 'Users' },
  {
    id: 'settings',
    label: 'Settings',
    children: [
      { id: 'settings-basic', label: 'Basic Configuration' },
      { id: 'settings-alarm', label: 'Alarm Settings' }
    ]
  },
  { id: 'location', label: 'Location' },
  { id: 'devices', label: 'Devices' },
  { id: 'commands', label: 'Commands' },
  { id: 'replies', label: 'Replies' }
]

export default function Sidebar({ activeSection, onChangeSection }) {
  return (
    <aside className="sidebar-panel">
      <div className="sidebar-logo">EV12 LOGO</div>
      <ul className="sidebar-nav">
        {sidebarItems.map((item) => (
          <li key={item.id}>
            <a
              className={activeSection === item.id ? 'active' : ''}
              href="#"
              onClick={(event) => {
                event.preventDefault()
                onChangeSection(item.id)
              }}
            >
              {item.label}
            </a>
            {item.children ? (
              <ul className="sidebar-subnav">
                {item.children.map((child) => (
                  <li key={child.id}>
                    <a
                      className={activeSection === child.id ? 'active sub-active' : ''}
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
      <button className="logout-link" type="button">Logout</button>
    </aside>
  )
}
