import { useMemo, useState } from 'react'

const roleOptions = [
  { label: 'Super Admin', value: 1 },
  { label: 'Manager', value: 2 },
  { label: 'User', value: 3 }
]

const boolToFlag = (value) => (value ? 1 : 0)

const formatReply = (reply) => {
  const date = Number(reply.date || 0)
  const dateLabel = date ? new Date(date).toLocaleString() : 'Unknown time'
  return `[${dateLabel}] ${reply.from}: ${reply.message}`
}

const buildEv12Preview = (form) => {
  const commands = []

  if (form.contactNumber) {
    commands.push(
      `A${form.contactSlot || 1},${boolToFlag(form.contactSmsEnabled)},${boolToFlag(form.contactCallEnabled)},${form.contactNumber}${form.contactName ? `,${form.contactName}` : ''}`
    )
  }
  if (form.smsPassword) commands.push(`P${form.smsPassword}`)
  if (form.smsWhitelistEnabled) commands.push('sms1')
  if (form.requestLocation) commands.push('loc')
  if (form.requestGpsLocation) commands.push('loc,gps')
  if (form.requestLbsLocation) commands.push('LBS1')
  if (form.sosMode && form.sosActionTime) commands.push(`SOS${form.sosMode},${form.sosActionTime}`)
  if (form.fallDownEnabled !== '') commands.push(`fl${form.fallDownEnabled},${form.fallDownSensitivity || 5},${boolToFlag(form.fallDownCall)}`)
  if (form.motionEnabled !== '') commands.push(`mo${form.motionEnabled},${form.motionStaticTime || '05m'},${form.motionDurationTime || '03s'},${boolToFlag(form.motionCall)}`)
  if (form.overSpeedEnabled !== '' && form.overSpeedLimit) commands.push(`Speed${form.overSpeedEnabled},${form.overSpeedLimit}`)
  if (form.geoFenceEnabled !== '' && form.geoFenceRadius) commands.push(`Geo1,${form.geoFenceEnabled},${form.geoFenceMode || 0},${form.geoFenceRadius}`)
  if (form.wifiEnabled !== '') commands.push(`Wifi${form.wifiEnabled}`)
  if (form.speakerVolume) commands.push(`Speakervolume${form.speakerVolume}`)
  if (form.prefixName) commands.push(`prefix1,${form.prefixName}`)
  if (form.continuousLocateInterval && form.continuousLocateDuration) commands.push(`CL${form.continuousLocateInterval},${form.continuousLocateDuration}`)
  if (form.timeZone) commands.push(`tz${form.timeZone}`)
  if (form.checkStatus) commands.push('status')

  return commands.join(',')
}

export default function App() {
  const [activeView, setActiveView] = useState('login')
  const [authStatus, setAuthStatus] = useState('Not logged in.')
  const [session, setSession] = useState(null)

  const [registerForm, setRegisterForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    contactNumber: '',
    address: '',
    userRole: 3,
    locationId: '',
    managerId: ''
  })
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })

  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [lastSentPhone, setLastSentPhone] = useState('')
  const [lastSeenTimestamp, setLastSeenTimestamp] = useState(0)
  const [status, setStatus] = useState('Ready.')
  const [gatewayBaseUrl, setGatewayBaseUrl] = useState('')
  const [gatewayToken, setGatewayToken] = useState('')
  const [replies, setReplies] = useState([])
  const [loading, setLoading] = useState(false)
  const [configStatus, setConfigStatus] = useState('')
  const [configResult, setConfigResult] = useState(null)

  const [configForm, setConfigForm] = useState({
    deviceId: '',
    imei: '',
    contactSlot: 1,
    contactNumber: '',
    contactName: '',
    contactSmsEnabled: true,
    contactCallEnabled: true,
    smsPassword: '',
    smsWhitelistEnabled: false,
    requestLocation: true,
    requestGpsLocation: false,
    requestLbsLocation: false,
    sosMode: 1,
    sosActionTime: 20,
    fallDownEnabled: '1',
    fallDownSensitivity: 5,
    fallDownCall: true,
    motionEnabled: '1',
    motionStaticTime: '05m',
    motionDurationTime: '03s',
    motionCall: true,
    overSpeedEnabled: '1',
    overSpeedLimit: '100km/h',
    geoFenceEnabled: '1',
    geoFenceMode: '0',
    geoFenceRadius: '100m',
    wifiEnabled: '1',
    speakerVolume: '90',
    prefixName: 'Emma',
    continuousLocateInterval: '10s',
    continuousLocateDuration: '600s',
    timeZone: '+08:00',
    checkStatus: true
  })

  const commandPreview = useMemo(() => buildEv12Preview(configForm), [configForm])
  const formattedReplies = useMemo(() => (replies.length ? replies.map(formatReply).join('\n') : 'No replies loaded yet.'), [replies])

  const commonHeaders = () => ({
    ...(gatewayBaseUrl.trim() ? { 'X-Gateway-Base-Url': gatewayBaseUrl.trim() } : {}),
    ...(gatewayToken.trim() ? { Authorization: gatewayToken.trim() } : {})
  })

  const register = async () => {
    try {
      const payload = {
        ...registerForm,
        userRole: Number(registerForm.userRole),
        locationId: registerForm.locationId ? Number(registerForm.locationId) : null,
        managerId: registerForm.managerId ? Number(registerForm.managerId) : null
      }

      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Registration failed')

      setAuthStatus(`Registered ${data.email} successfully.`)
      setActiveView('login')
    } catch (error) {
      setAuthStatus(`Register failed: ${error.message}`)
    }
  }

  const login = async () => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Login failed')

      setSession(data)
      setAuthStatus(`Logged in as ${data.user.firstName} ${data.user.lastName} (role ${data.user.userRole}).`)
      setActiveView('dashboard')
    } catch (error) {
      setAuthStatus(`Login failed: ${error.message}`)
    }
  }

  const sendMessage = async () => {
    const to = phone.trim()
    const body = message.trim()

    if (!to || !body) {
      setStatus('Phone and message are required.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...commonHeaders() },
        body: JSON.stringify({ to, message: body })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to send message')

      setLastSentPhone(to)
      setStatus(`Message sent to ${to}.`)
    } catch (error) {
      setStatus(`Send failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const fetchReplies = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/messages/replies?phone=${encodeURIComponent(lastSentPhone)}&since=${lastSeenTimestamp}`, {
        headers: commonHeaders()
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to fetch replies')

      const incoming = Array.isArray(data.messages) ? data.messages : []
      const newTimestamp = Number(data.lastSeenTimestamp || lastSeenTimestamp)

      setReplies(incoming)
      setLastSeenTimestamp(newTimestamp)
      setStatus(`Loaded ${incoming.length} replies.`)
    } catch (error) {
      setStatus(`Fetch failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const sendConfig = async () => {
    setLoading(true)
    setConfigStatus('Sending configuration...')
    try {
      const response = await fetch('/api/config/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...commonHeaders() },
        body: JSON.stringify({ ...configForm, command: commandPreview })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to send configuration')

      setConfigResult(data)
      setConfigStatus('Configuration sent successfully.')
    } catch (error) {
      setConfigStatus(`Config failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const renderAuthCard = () => {
    if (activeView === 'register') {
      return (
        <section className="card auth-card">
          <h2>Create account</h2>
          <p className="subtitle">Register a new user profile before accessing the dashboard.</p>
          <input placeholder="Email" value={registerForm.email} onChange={(e) => setRegisterForm((p) => ({ ...p, email: e.target.value }))} />
          <input placeholder="Password" type="password" value={registerForm.password} onChange={(e) => setRegisterForm((p) => ({ ...p, password: e.target.value }))} />
          <input placeholder="First name" value={registerForm.firstName} onChange={(e) => setRegisterForm((p) => ({ ...p, firstName: e.target.value }))} />
          <input placeholder="Last name" value={registerForm.lastName} onChange={(e) => setRegisterForm((p) => ({ ...p, lastName: e.target.value }))} />
          <input placeholder="Contact number" value={registerForm.contactNumber} onChange={(e) => setRegisterForm((p) => ({ ...p, contactNumber: e.target.value }))} />
          <input placeholder="Address" value={registerForm.address} onChange={(e) => setRegisterForm((p) => ({ ...p, address: e.target.value }))} />
          <label>User role</label>
          <select value={registerForm.userRole} onChange={(e) => setRegisterForm((p) => ({ ...p, userRole: Number(e.target.value) }))}>
            {roleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button onClick={register}>Register</button>
        </section>
      )
    }

    return (
      <section className="card auth-card">
        <h2>Sign in</h2>
        <p className="subtitle">Use your account credentials to open the dashboard.</p>
        <input placeholder="Email" value={loginForm.email} onChange={(e) => setLoginForm((p) => ({ ...p, email: e.target.value }))} />
        <input placeholder="Password" type="password" value={loginForm.password} onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))} />
        <button onClick={login}>Login</button>
        {session ? <pre className="replies">{JSON.stringify(session, null, 2)}</pre> : null}
      </section>
    )
  }

  return (
    <main className="container">
      <header className="card topbar">
        <div>
          <h1>EV12 Frontend Console</h1>
          <p className="subtitle">Professional workspace with separate Login, Register, and Dashboard experiences.</p>
        </div>
        <nav className="tabs">
          <button className={activeView === 'login' ? 'tab active' : 'tab'} onClick={() => setActiveView('login')}>Login</button>
          <button className={activeView === 'register' ? 'tab active' : 'tab'} onClick={() => setActiveView('register')}>Register</button>
          <button className={activeView === 'dashboard' ? 'tab active' : 'tab'} onClick={() => setActiveView('dashboard')}>Dashboard</button>
        </nav>
        <div className="status">{authStatus}</div>
      </header>

      {activeView === 'dashboard' ? (
        <>
          <section className="card">
            <h2>Gateway Overrides</h2>
            <div className="field-grid two-col">
              <div>
                <label>Gateway Base URL</label>
                <input placeholder="https://example.com (optional)" value={gatewayBaseUrl} onChange={(e) => setGatewayBaseUrl(e.target.value)} />
              </div>
              <div>
                <label>Gateway Token</label>
                <input placeholder="Authorization token (optional)" value={gatewayToken} onChange={(e) => setGatewayToken(e.target.value)} />
              </div>
            </div>
          </section>

          <section className="card command-builder">
            <div className="section-heading">
              <h2>EV12 Command Builder</h2>
              <p className="subtitle">Structured device configuration with live command preview.</p>
            </div>

            <div className="builder-layout">
              <div className="builder-column">
                <article className="panel">
                  <h3>Device & Contact</h3>
                  <div className="field-grid">
                    <div><label>Device ID</label><input value={configForm.deviceId} onChange={(e) => setConfigForm((p) => ({ ...p, deviceId: e.target.value }))} /></div>
                    <div><label>IMEI</label><input value={configForm.imei} onChange={(e) => setConfigForm((p) => ({ ...p, imei: e.target.value }))} /></div>
                    <div><label>Contact Number</label><input value={configForm.contactNumber} onChange={(e) => setConfigForm((p) => ({ ...p, contactNumber: e.target.value }))} /></div>
                    <div><label>Contact Name</label><input value={configForm.contactName} onChange={(e) => setConfigForm((p) => ({ ...p, contactName: e.target.value }))} /></div>
                    <div><label>SMS Password</label><input value={configForm.smsPassword} onChange={(e) => setConfigForm((p) => ({ ...p, smsPassword: e.target.value }))} /></div>
                    <div><label>Prefix Name</label><input value={configForm.prefixName} onChange={(e) => setConfigForm((p) => ({ ...p, prefixName: e.target.value }))} /></div>
                  </div>
                </article>

                <article className="panel">
                  <h3>Safety & Tracking</h3>
                  <div className="field-grid">
                    <div><label>Over Speed Limit</label><input value={configForm.overSpeedLimit} onChange={(e) => setConfigForm((p) => ({ ...p, overSpeedLimit: e.target.value }))} /></div>
                    <div><label>Geo Fence Radius</label><input value={configForm.geoFenceRadius} onChange={(e) => setConfigForm((p) => ({ ...p, geoFenceRadius: e.target.value }))} /></div>
                    <div><label>Locate Interval</label><input value={configForm.continuousLocateInterval} onChange={(e) => setConfigForm((p) => ({ ...p, continuousLocateInterval: e.target.value }))} /></div>
                    <div><label>Locate Duration</label><input value={configForm.continuousLocateDuration} onChange={(e) => setConfigForm((p) => ({ ...p, continuousLocateDuration: e.target.value }))} /></div>
                    <div><label>Time Zone</label><input value={configForm.timeZone} onChange={(e) => setConfigForm((p) => ({ ...p, timeZone: e.target.value }))} /></div>
                    <div><label>Speaker Volume</label><input value={configForm.speakerVolume} onChange={(e) => setConfigForm((p) => ({ ...p, speakerVolume: e.target.value }))} /></div>
                  </div>
                </article>
              </div>

              <div className="builder-column">
                <article className="panel">
                  <h3>Feature Toggles</h3>
                  <div className="toggle-grid">
                    <label className="toggle-item"><input type="checkbox" checked={configForm.requestLocation} onChange={(e) => setConfigForm((p) => ({ ...p, requestLocation: e.target.checked }))} /> Request location (loc)</label>
                    <label className="toggle-item"><input type="checkbox" checked={configForm.requestGpsLocation} onChange={(e) => setConfigForm((p) => ({ ...p, requestGpsLocation: e.target.checked }))} /> Request GPS (loc,gps)</label>
                    <label className="toggle-item"><input type="checkbox" checked={configForm.smsWhitelistEnabled} onChange={(e) => setConfigForm((p) => ({ ...p, smsWhitelistEnabled: e.target.checked }))} /> SMS whitelist</label>
                    <label className="toggle-item"><input type="checkbox" checked={configForm.fallDownCall} onChange={(e) => setConfigForm((p) => ({ ...p, fallDownCall: e.target.checked }))} /> Fall detection call</label>
                    <label className="toggle-item"><input type="checkbox" checked={configForm.motionCall} onChange={(e) => setConfigForm((p) => ({ ...p, motionCall: e.target.checked }))} /> Motion alarm call</label>
                    <label className="toggle-item"><input type="checkbox" checked={configForm.checkStatus} onChange={(e) => setConfigForm((p) => ({ ...p, checkStatus: e.target.checked }))} /> Include status</label>
                  </div>
                </article>

                <article className="panel">
                  <h3>Command Preview</h3>
                  <p className="hint">Preview uses comma separators. Backend chunking is still respected.</p>
                  <pre className="replies command-preview">{commandPreview || 'No commands yet.'}</pre>
                  <button disabled={loading} className="primary-action" onClick={sendConfig}>Send EV12 Config</button>
                  <div className="status">{configStatus}</div>
                  {configResult ? <pre className="replies">{JSON.stringify(configResult, null, 2)}</pre> : null}
                </article>
              </div>
            </div>
          </section>

          <section className="card">
            <h2>Send Single Message</h2>
            <input placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <textarea rows={4} placeholder="Type your message" value={message} onChange={(e) => setMessage(e.target.value)} />
            <button disabled={loading} onClick={sendMessage}>Send</button>
          </section>

          <section className="card">
            <h2>Fetch Replies</h2>
            <button disabled={loading} onClick={fetchReplies}>Manually Fetch Replies</button>
            <div className="status">{status}</div>
            <pre className="replies">{formattedReplies}</pre>
          </section>
        </>
      ) : (
        renderAuthCard()
      )}
    </main>
  )
}
