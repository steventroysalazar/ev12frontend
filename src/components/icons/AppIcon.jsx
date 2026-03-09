const iconPaths = {
  dashboard: <path d="M4 4h6v6H4zM14 4h6v4h-6zM14 10h6v10h-6zM4 14h6v6H4z" />,
  users: <><path d="M7 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" /><path d="M17 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" /><path d="M2.5 19a4.5 4.5 0 0 1 9 0" /><path d="M13 19a4 4 0 0 1 8 0" /></>,
  location: <><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  devices: <><rect x="7" y="2.5" width="10" height="19" rx="2" /><circle cx="12" cy="18" r="1" /></>,
  replies: <path d="M4 5h16v11H7l-3 3z" />,
  settings: <path d="M12 3v3m0 12v3m9-9h-3M6 12H3m15.36-6.36-2.12 2.12M7.76 16.24l-2.12 2.12m12.72 0-2.12-2.12M7.76 7.76 5.64 5.64M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
  command: <path d="M4 12h11m0 0-3-3m3 3-3 3M4 6h16M4 18h16" />,
  refresh: <><path d="M20 4v6h-6" /><path d="M4 20v-6h6" /><path d="M20 10a8 8 0 0 0-14-4" /><path d="M4 14a8 8 0 0 0 14 4" /></>,
  plusUser: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></>,
  battery: <><rect x="2" y="7" width="18" height="10" rx="2" /><path d="M22 10v4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  message: <path d="M4 5h16v11H7l-3 3z" />
}

export default function AppIcon({ name, className = '', strokeWidth = 1.8 }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {iconPaths[name] || iconPaths.dashboard}
    </svg>
  )
}
