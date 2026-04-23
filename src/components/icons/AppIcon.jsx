const iconPaths = {
  dashboard: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.2" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.2" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.2" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="9" r="2.6" />
      <path d="M3.9 17.6a5.1 5.1 0 0 1 10.2 0" />
      <circle cx="16.6" cy="8.1" r="2.1" />
      <path d="M14.4 14.9a4.3 4.3 0 0 1 5.7 2.7" />
    </>
  ),
  company: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="1.5" />
      <path d="M9 5v15M15 5v15M4 10h16M4 15h16" />
    </>
  ),
  location: (
    <>
      <path d="M12 20.6s6.2-5.4 6.2-10a6.2 6.2 0 0 0-12.4 0c0 4.6 6.2 10 6.2 10z" />
      <circle cx="12" cy="10.2" r="1.9" />
    </>
  ),
  devices: (
    <>
      <rect x="7.4" y="2.8" width="9.2" height="18.4" rx="2.2" />
      <path d="M10.3 5.6h3.4" />
      <circle cx="12" cy="17.8" r="0.95" />
    </>
  ),
  replies: (
    <>
      <path d="M4.2 5.2h15.6v10.6H7.8l-3.6 3z" />
    </>
  ),
  settings: <path d="M12 3v3m0 12v3m9-9h-3M6 12H3m15.36-6.36-2.12 2.12M7.76 16.24l-2.12 2.12m12.72 0-2.12-2.12M7.76 7.76 5.64 5.64M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
  command: <path d="M4 12h11m0 0-3-3m3 3-3 3M4 6h16M4 18h16" />,
  refresh: (
    <>
      <path d="M20.7 8.3v-4.1h-4.1" />
      <path d="M20.3 12a8.3 8.3 0 1 1-3.1-6.4" />
    </>
  ),
  plusUser: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>,
  battery: <><rect x="2" y="7" width="18" height="10" rx="2" /><path d="M22 10v4" /></>,
  clock: (
    <>
      <path d="M20.7 8.3v-4.1h-4.1" />
      <path d="M20.3 12a8.3 8.3 0 1 1-3.1-6.4" />
      <path d="M12 8.3v3.9l2.5 1.8" />
    </>
  ),
  webhook: (
    <>
      <circle cx="12" cy="5.5" r="2.1" />
      <circle cx="6.1" cy="15.7" r="2.1" />
      <circle cx="17.9" cy="15.7" r="2.1" />
      <path d="M10.8 7.2 7.4 13.3" />
      <path d="M13.2 7.2l3.4 6.1" />
      <path d="M8.6 15.7h6.8" />
    </>
  ),
  warning: (
    <>
      <path d="M12 4.5 3.8 19h16.4L12 4.5z" />
      <path d="M12 9.5v4.8" />
      <circle cx="12" cy="16.6" r="0.7" fill="currentColor" stroke="none" />
    </>
  ),
  message: <path d="M4 5h16v11H7l-3 3z" />
}

export default function AppIcon({ name, className = '', strokeWidth = 1.8 }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {iconPaths[name] || iconPaths.dashboard}
    </svg>
  )
}
