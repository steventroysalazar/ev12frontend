import './sidebar.css'

const Icon = ({ id }) => {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' }

  if (id === 'dashboard') return <svg {...common}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
  if (id === 'users') return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8v6" /><path d="M23 11h-6" /></svg>
  if (id === 'locations' || id === 'location') return <svg {...common}><path d="M21 10c0 6-9 12-9 12S3 16 3 10a9 9 0 1 1 18 0Z" /><circle cx="12" cy="10" r="3" /></svg>
  if (id === 'devices') return <svg {...common}><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 5h2" /><circle cx="12" cy="18" r="1" /></svg>
  if (id === 'settings') return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 0 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 0 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2H9a1 1 0 0 0 .6-.9V4a2 2 0 0 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1V9c0 .4.2.7.6.9H20a2 2 0 0 1 0 4h-.2a1 1 0 0 0-.9.6Z" /></svg>
  if (id === 'commands') return <svg {...common}><path d="M8 9l-4 3 4 3" /><path d="M16 9l4 3-4 3" /><path d="M14 4l-4 16" /></svg>
  if (id === 'replies') return <svg {...common}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
  if (id === 'webhooks') return <svg {...common}><path d="M18 8a3 3 0 0 0-6 0v8a3 3 0 1 0 6 0" /><path d="M6 8a3 3 0 0 1 6 0" /><path d="M6 16a3 3 0 1 0 6 0" /></svg>
  return null
}

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
  { id: 'replies', label: 'Replies' },
  { id: 'webhooks', label: 'Webhook Events' }
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
              <Icon id={item.id} />
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
      <button className="logout-link" type="button" onClick={onLogout}>↪ Logout</button>
    </aside>
  )
}
