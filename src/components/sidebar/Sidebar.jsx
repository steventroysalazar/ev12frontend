import './sidebar.css'

const sidebarSections = [
  { id: 'gateway', label: 'Gateway Overrides' },
  { id: 'builder', label: 'EV12 Command Builder' },
  { id: 'messaging', label: 'Send Message' },
  { id: 'replies', label: 'Fetch Replies' }
]

export default function Sidebar() {
  return (
    <aside className="sidebar card">
      <h3>Dashboard</h3>
      <p className="subtitle">Quick sections</p>
      <ul className="sidebar-nav">
        {sidebarSections.map((section) => (
          <li key={section.id}>
            <a href={`#${section.id}`}>{section.label}</a>
          </li>
        ))}
      </ul>
    </aside>
  )
}
