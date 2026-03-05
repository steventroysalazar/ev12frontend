import { useMemo, useState } from 'react'

const roleOptions = [
  { label: 'Super Admin', value: 1 },
  { label: 'Manager', value: 2 },
  { label: 'User', value: 3 }
]

const formatReply = (reply) => {
  const date = Number(reply.date || 0)
  const dateLabel = date ? new Date(date).toLocaleString() : 'Unknown time'
  return `[${dateLabel}] ${reply.from}: ${reply.message}`
}

const boolToFlag = (v) => (v ? 1 : 0)

const buildEv12Preview = (form) => {
  const commands = []

  if (form.contactNumber) {
    commands.push(`A${form.contactSlot || 1},${boolToFlag(form.contactSmsEnabled)},${boolToFlag(form.contactCallEnabled)},${form.contactNumber}${form.contactName ? `,${form.contactName}` : ''}`)
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

  const [registerForm, setRegisterForm] = useState({
    email: '', password: '', firstName: '', lastName: '', contactNumber: '', address: '', userRole: 3, locationId: '', managerId: ''
  })
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [authStatus, setAuthStatus] = useState('Not logged in.')
  const [session, setSession] = useState(null)

  const [configForm, setConfigForm] = useState({
    deviceId: '', imei: '', contactSlot: 1, contactNumber: '', contactName: '', contactSmsEnabled: true, contactCallEnabled: true,
    smsPassword: '', smsWhitelistEnabled: false, requestLocation: true, requestGpsLocation: false, requestLbsLocation: false,
    sosMode: 1, sosActionTime: 20, fallDownEnabled: '1', fallDownSensitivity: 5, fallDownCall: true,
    motionEnabled: '1', motionStaticTime: '05m', motionDurationTime: '03s', motionCall: true,
    overSpeedEnabled: '1', overSpeedLimit: '100km/h', geoFenceEnabled: '1', geoFenceMode: '0', geoFenceRadius: '100m',
    wifiEnabled: '1', speakerVolume: '90', prefixName: 'Emma',
    continuousLocateInterval: '10s', continuousLocateDuration: '600s', timeZone: '+08:00', checkStatus: true
  })

  const commandPreview = useMemo(() => buildEv12Preview(configForm), [configForm])

  const formattedReplies = useMemo(() => replies.length ? replies.map(formatReply).join('\n') : 'No replies loaded yet.', [replies])

  const register = async () => {
    try {
      const payload = { ...registerForm, userRole: Number(registerForm.userRole), locationId: registerForm.locationId ? Number(registerForm.locationId) : null, managerId: registerForm.managerId ? Number(registerForm.managerId) : null }
      const response = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Registration failed')
      setAuthStatus(`Registered ${data.email} successfully.`)
    } catch (error) { setAuthStatus(`Register failed: ${error.message}`) }
  }

  const login = async () => {
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(loginForm) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Login failed')
      setSession(data)
      setAuthStatus(`Logged in as ${data.user.firstName} ${data.user.lastName} (role ${data.user.userRole}).`)
    } catch (error) { setAuthStatus(`Login failed: ${error.message}`) }
  }

  const commonHeaders = () => ({
    ...(gatewayBaseUrl.trim() ? { 'X-Gateway-Base-Url': gatewayBaseUrl.trim() } : {}),
    ...(gatewayToken.trim() ? { Authorization: gatewayToken.trim() } : {})
  })

  const sendMessage = async () => {
    const to = phone.trim(); const body = message.trim()
    if (!to || !body) { setStatus('Phone and message are required.'); return }
    setLoading(true)
    try {
      const response = await fetch('/api/messages/send', { method: 'POST', headers: { 'Content-Type': 'application/json', ...commonHeaders() }, body: JSON.stringify({ to, message: body }) })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) { setStatus(`Send failed: ${payload.error || response.statusText}`); return }
      setLastSentPhone(to); setLastSeenTimestamp((current) => current || Date.now()); setStatus(`Message sent to ${to}. You can now fetch replies.`)
    } catch (error) { setStatus(`Send failed: ${error.message}`) } finally { setLoading(false) }
  }

  const sendConfig = async () => {
    if (!configForm.deviceId) { setConfigStatus('Device ID is required.'); return }
    setLoading(true)
    try {
      const payload = {
        ...configForm,
        deviceId: Number(configForm.deviceId),
        contactSlot: Number(configForm.contactSlot),
        sosMode: Number(configForm.sosMode),
        sosActionTime: Number(configForm.sosActionTime),
        fallDownEnabled: configForm.fallDownEnabled === '' ? null : configForm.fallDownEnabled === '1',
        motionEnabled: configForm.motionEnabled === '' ? null : configForm.motionEnabled === '1',
        motionCall: Boolean(configForm.motionCall),
        overSpeedEnabled: configForm.overSpeedEnabled === '' ? null : configForm.overSpeedEnabled === '1',
        geoFenceEnabled: configForm.geoFenceEnabled === '' ? null : configForm.geoFenceEnabled === '1',
        geoFenceMode: Number(configForm.geoFenceMode),
        wifiEnabled: configForm.wifiEnabled === '' ? null : configForm.wifiEnabled === '1',
        speakerVolume: configForm.speakerVolume ? Number(configForm.speakerVolume) : null
      }
      const response = await fetch('/api/send-config', { method: 'POST', headers: { 'Content-Type': 'application/json', ...commonHeaders() }, body: JSON.stringify(payload) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Config send failed')
      setConfigResult(data)
      setConfigStatus(`Sent ${data.messages?.length || 0} SMS chunk(s) to ${data.deviceNumber}.`)
    } catch (error) { setConfigStatus(`Config send failed: ${error.message}`) } finally { setLoading(false) }
  }

  const fetchReplies = async () => {
    const targetPhone = lastSentPhone.trim()
    if (!targetPhone) { setStatus('Send a message first so the app knows what phone number to check.'); return }
    const params = new URLSearchParams({ phone: targetPhone, limit: '100' })
    if (lastSeenTimestamp > 0) params.set('since', String(lastSeenTimestamp))
    setLoading(true)
    try {
      const response = await fetch(`/api/messages/replies?${params.toString()}`, { headers: commonHeaders() })
      const payload = await response.json().catch(() => [])
      if (!response.ok) { setStatus(`Fetch failed: ${payload.error || response.statusText}`); return }
      if (!Array.isArray(payload) || payload.length === 0) { setStatus(`No new replies for ${targetPhone}.`); return }
      const maxDate = Math.max(...payload.map((item) => Number(item.date) || 0)); if (maxDate > 0) setLastSeenTimestamp(maxDate + 1)
      setReplies(payload); setStatus(`Fetched ${payload.length} reply/replies for ${targetPhone}.`)
    } catch (error) { setStatus(`Fetch failed: ${error.message}`) } finally { setLoading(false) }
  }

  return (
    <main className="container">
      <h1>SMS Gateway Portal</h1>

      <section className="card">
        <h2>Authentication</h2>
        <p className="status">{authStatus}</p>
        <div className="grid-two">
          <div>
            <h3>Register</h3>
            <input placeholder="Email" value={registerForm.email} onChange={(e) => setRegisterForm((p) => ({ ...p, email: e.target.value }))} />
            <input placeholder="Password" type="password" value={registerForm.password} onChange={(e) => setRegisterForm((p) => ({ ...p, password: e.target.value }))} />
            <input placeholder="First name" value={registerForm.firstName} onChange={(e) => setRegisterForm((p) => ({ ...p, firstName: e.target.value }))} />
            <input placeholder="Last name" value={registerForm.lastName} onChange={(e) => setRegisterForm((p) => ({ ...p, lastName: e.target.value }))} />
            <label>User role</label>
            <select value={registerForm.userRole} onChange={(e) => setRegisterForm((p) => ({ ...p, userRole: Number(e.target.value) }))}>{roleOptions.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select>
            <button onClick={register}>Register</button>
          </div>
          <div>
            <h3>Login</h3>
            <input placeholder="Email" value={loginForm.email} onChange={(e) => setLoginForm((p) => ({ ...p, email: e.target.value }))} />
            <input placeholder="Password" type="password" value={loginForm.password} onChange={(e) => setLoginForm((p) => ({ ...p, password: e.target.value }))} />
            <button onClick={login}>Login</button>
            {session ? <pre className="replies">{JSON.stringify(session, null, 2)}</pre> : null}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Gateway Overrides</h2>
        <input placeholder="Gateway Base URL (optional)" value={gatewayBaseUrl} onChange={(e) => setGatewayBaseUrl(e.target.value)} />
        <input placeholder="Gateway Token (optional)" value={gatewayToken} onChange={(e) => setGatewayToken(e.target.value)} />
      </section>

      <section className="card">
        <h2>EV12 Command Builder (Frontend update)</h2>
        <div className="grid-two">
          <div>
            <input placeholder="Device ID" value={configForm.deviceId} onChange={(e) => setConfigForm((p) => ({ ...p, deviceId: e.target.value }))} />
            <input placeholder="Device IMEI (read-only ref)" value={configForm.imei} onChange={(e) => setConfigForm((p) => ({ ...p, imei: e.target.value }))} />
            <input placeholder="Contact Number" value={configForm.contactNumber} onChange={(e) => setConfigForm((p) => ({ ...p, contactNumber: e.target.value }))} />
            <input placeholder="Contact Name" value={configForm.contactName} onChange={(e) => setConfigForm((p) => ({ ...p, contactName: e.target.value }))} />
            <input placeholder="SMS Password" value={configForm.smsPassword} onChange={(e) => setConfigForm((p) => ({ ...p, smsPassword: e.target.value }))} />
            <input placeholder="Over speed limit (e.g. 100km/h)" value={configForm.overSpeedLimit} onChange={(e) => setConfigForm((p) => ({ ...p, overSpeedLimit: e.target.value }))} />
            <input placeholder="Geo radius (e.g. 100m)" value={configForm.geoFenceRadius} onChange={(e) => setConfigForm((p) => ({ ...p, geoFenceRadius: e.target.value }))} />
            <input placeholder="CL interval" value={configForm.continuousLocateInterval} onChange={(e) => setConfigForm((p) => ({ ...p, continuousLocateInterval: e.target.value }))} />
            <input placeholder="CL duration" value={configForm.continuousLocateDuration} onChange={(e) => setConfigForm((p) => ({ ...p, continuousLocateDuration: e.target.value }))} />
            <button disabled={loading} onClick={sendConfig}>Send EV12 Config</button>
          </div>
          <div>
            <label className="checkbox-row"><input type="checkbox" checked={configForm.requestLocation} onChange={(e) => setConfigForm((p) => ({ ...p, requestLocation: e.target.checked }))} /> Request location (loc)</label>
            <label className="checkbox-row"><input type="checkbox" checked={configForm.requestGpsLocation} onChange={(e) => setConfigForm((p) => ({ ...p, requestGpsLocation: e.target.checked }))} /> Request GPS (loc,gps)</label>
            <label className="checkbox-row"><input type="checkbox" checked={configForm.smsWhitelistEnabled} onChange={(e) => setConfigForm((p) => ({ ...p, smsWhitelistEnabled: e.target.checked }))} /> SMS White List</label>
            <label className="checkbox-row"><input type="checkbox" checked={configForm.fallDownCall} onChange={(e) => setConfigForm((p) => ({ ...p, fallDownCall: e.target.checked }))} /> Fall detection call</label>
            <label className="checkbox-row"><input type="checkbox" checked={configForm.motionCall} onChange={(e) => setConfigForm((p) => ({ ...p, motionCall: e.target.checked }))} /> Motion alarm call</label>
            <label className="checkbox-row"><input type="checkbox" checked={configForm.checkStatus} onChange={(e) => setConfigForm((p) => ({ ...p, checkStatus: e.target.checked }))} /> Status</label>
            <p className="hint">Preview uses comma separator and backend splits every 150 chars.</p>
            <pre className="replies">{commandPreview || 'No commands yet.'}</pre>
            <div className="status">{configStatus}</div>
            {configResult ? <pre className="replies">{JSON.stringify(configResult, null, 2)}</pre> : null}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Send single message</h2>
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
    </main>
  )
}
