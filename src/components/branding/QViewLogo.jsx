export default function QViewLogo({ className = '', title = 'QView logo' }) {
  return (
    <svg className={className} viewBox="0 0 230 136" role="img" aria-label={title}>
      <title>{title}</title>
      <circle cx="82" cy="68" r="50" fill="none" stroke="#1f7389" strokeWidth="24" />
      <path d="M118 78h22l18 30 31-50h22l-42 66h-26z" fill="#ff2f22" />
    </svg>
  )
}
