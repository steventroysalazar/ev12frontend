const iconPaths = {
  dashboard: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.4" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.4" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8.2" r="2.8" />
      <path d="M3.8 18a5.3 5.3 0 0 1 10.4 0" />
      <circle cx="17.2" cy="9.1" r="2.3" />
      <path d="M14.2 17.3a4.6 4.6 0 0 1 5.6-2.1 4.6 4.6 0 0 1 .9.4" />
    </>
  ),
  location: (
    <>
      <path d="M12 21s6.6-5.9 6.6-10.7a6.6 6.6 0 0 0-13.2 0C5.4 15.1 12 21 12 21z" />
      <circle cx="12" cy="10.2" r="2.3" />
    </>
  ),
  devices: (
    <>
      <rect x="7.3" y="2.7" width="9.4" height="18.6" rx="2.1" />
      <path d="M10 5.7h4" />
      <circle cx="12" cy="17.9" r="1" />
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
      <path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <path d="M21 3v6h-6" />
    </>
  ),
  plusUser: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>,
  battery: <><rect x="2" y="7" width="18" height="10" rx="2" /><path d="M22 10v4" /></>,
  clock: (
    <>
      <path d="M21 12a9 9 0 1 1-2.6-6.4" />
      <path d="M21 3v6h-6" />
      <path d="M12 8v4.2l2.8 1.8" />
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
