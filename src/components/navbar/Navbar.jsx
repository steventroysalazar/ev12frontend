import './navbar.css'
export default function Navbar({ activeView, authStatus, onChangeView }) {
  return (
    <header className="card topbar">
      <div>
        <h1>EV12 Frontend Console</h1>
        <p className="subtitle">Professional workspace with separated authentication and dashboard modules.</p>
      </div>
      <nav className="tabs">
        <button className={activeView === 'login' ? 'tab active' : 'tab'} onClick={() => onChangeView('login')}>Login</button>
        <button className={activeView === 'register' ? 'tab active' : 'tab'} onClick={() => onChangeView('register')}>Register</button>
        <button className={activeView === 'home' ? 'tab active' : 'tab'} onClick={() => onChangeView('home')}>Home</button>
      </nav>
      <div className="status">{authStatus}</div>
    </header>
  )
}
