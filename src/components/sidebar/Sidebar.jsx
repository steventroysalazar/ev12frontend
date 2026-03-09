import './sidebar.css'

const Icon = ({ id }) => {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' }

  if (id === 'dashboard') {
    return <svg {...common}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>
  }

  if (id === 'users') {
    return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><path d="M20 8v6" /><path d="M23 11h-6" /></svg>
  }

  if (id === 'location') {
    return <svg {...common}><path d="M21 10c0 6-9 12-9 12S3 16 3 10a9 9 0 1 1 18 0Z" /><circle cx="12" cy="10" r="3" /></svg>
  }

  if (id === 'devices') {
    return <svg {...common}><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 5h2" /><circle cx="12" cy="18" r="1" /></svg>
  }

  return <svg {...common}><path d="M4 4h16v12H4z" /><path d="m4 16 4-4h12" /></svg>
}

const sidebarItems = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'users', label: 'Users' },
  { id: 'locations', label: 'Location' },
  { id: 'devices', label: 'Devices' },
  { id: 'replies', label: 'Replies' }
]

export default function Sidebar({ activeSection, onChangeSection, onLogout }) {
  return (
    <aside className="sidebar-panel">
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
              <Icon id={item.id} />
              <span>{item.label}</span>
            </a>
          </li>
        ))}
      </ul>
      <button className="logout-link" type="button" onClick={onLogout}>↪ Logout</button>
    </aside>
  )
}
