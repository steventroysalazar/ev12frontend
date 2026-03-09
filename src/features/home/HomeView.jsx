import { useCallback, useEffect, useMemo, useState } from 'react'
import Sidebar from '../../components/sidebar/Sidebar'
import { fetchJsonWithFallback } from '../../lib/apiClient'
import './home.css'

const deviceRows = [
  ['Device Name', 'Lorem - EV12'],
  ['Device Phone Number', '+639108653532'],
  ['Owner User', 'John Doe'],
  ['Owner Location', 'Sydney, Australia'],
  ['Last reply', '04-03-2026 23:15'],
  ['Battery status', '74%']
]

const initialLocationForm = { name: '', details: '' }
const initialUserForm = { email: '', password: '', firstName: '', lastName: '', contactNumber: '', address: '', userRole: 3, locationId: '', managerId: '' }
const initialDeviceForm = { name: '', phoneNumber: '', ownerUserId: '', locationId: '' }

export default function HomeView({
  onLogout,
  gatewayBaseUrl,
  gatewayToken,
  setGatewayBaseUrl,
  setGatewayToken,
  configForm,
  setConfigForm,
  commandPreview,
  configStatus,
  configResult,
  sendConfig,
  loading,
  phone,
  message,
  setPhone,
  setMessage,
  sendMessage,
  fetchReplies,
  requestLocationUpdate,
  locationResult,
  status,
  formattedReplies,
  repliesCount,
  authToken,
  user
}) {
  const [activeSection, setActiveSection] = useState('dashboard')
  const [selectedDevice, setSelectedDevice] = useState(null)

  const [showUserModal, setShowUserModal] = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [showDeviceModal, setShowDeviceModal] = useState(false)

export default function HomeView({ onLogout, loading, fetchReplies, requestLocationUpdate, repliesCount, authToken, sendConfig, user }) {
  const [activeSection, setActiveSection] = useState('dashboard')
  const [users, setUsers] = useState([])
  const [locations, setLocations] = useState([])
  const [devices, setDevices] = useState([])
  const [dataStatus, setDataStatus] = useState('')
  const [actionStatus, setActionStatus] = useState({ type: '', message: '' })

  const [showUserModal, setShowUserModal] = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [showDeviceModal, setShowDeviceModal] = useState(false)
  const [locationForm, setLocationForm] = useState(initialLocationForm)
  const [userForm, setUserForm] = useState(initialUserForm)
  const [deviceForm, setDeviceForm] = useState(initialDeviceForm)

  const fetchJson = useCallback(async (url, options = {}) => fetchJsonWithFallback(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: authToken } : {}), ...(options.headers || {}) }
  }), [authToken])

  const loadUsers = useCallback(async () => {
    const data = await fetchJson('/api/users', { headers: {} })
    setUsers(Array.isArray(data) ? data : data.users || [])
  }, [fetchJson])

  const loadLocations = useCallback(async () => {
    const data = await fetchJson('/api/locations', { headers: {} })
    setLocations(Array.isArray(data) ? data : data.locations || [])
  }, [fetchJson])

  const loadDevices = useCallback(async () => {
    try {
      const data = await fetchJson('/api/devices', { headers: {} })
      setDevices(Array.isArray(data) ? data : data.devices || [])
    } catch {
      const data = await fetchJson('/api/users', { headers: {} })
      const usersList = Array.isArray(data) ? data : data.users || []
      setDevices(usersList.flatMap((u) => Array.isArray(u.devices) ? u.devices.map((d) => ({ ...d, owner: u })) : []))
    }
  }, [fetchJson])

  useEffect(() => {
    const load = async () => {
      try {
        if (activeSection === 'users') await loadUsers()
        if (activeSection === 'locations') await loadLocations()
        if (activeSection === 'devices') await loadDevices()
        if (activeSection === 'dashboard') await Promise.all([loadUsers(), loadLocations(), loadDevices()])
        setDataStatus('')
      } catch (error) {
        setDataStatus(`Data fetch failed: ${error.message}`)
      }
    }
    load()
  }, [activeSection, loadUsers, loadLocations, loadDevices])

  const metrics = useMemo(() => [
    { label: 'TOTAL USERS', value: users.length },
    { label: 'TOTAL DEVICES', value: devices.length },
    { label: 'TOTAL LOCATIONS', value: locations.length },
    { label: 'RECENT REPLIES', value: repliesCount || 0 }
  ], [users.length, devices.length, locations.length, repliesCount])

  const managers = users.filter((u) => Number(u.userRole) === 2)

  const handleCreateLocation = async () => {
    try {
      if (!locationForm.name.trim()) throw new Error('Location name is required')
      await fetchJson('/api/locations', { method: 'POST', body: JSON.stringify({ name: locationForm.name.trim(), details: locationForm.details.trim() }) })
      setActionStatus({ type: 'success', message: 'Location created successfully.' })
      setLocationForm(initialLocationForm)
      setShowLocationModal(false)
      await loadLocations()
    } catch (error) { setActionStatus({ type: 'error', message: `Create location failed: ${error.message}` }) }
  }

  const handleCreateUser = async () => {
    try {
      if (!userForm.email.trim() || !userForm.password.trim()) throw new Error('Email and password are required')
      const payload = { ...userForm, userRole: Number(userForm.userRole), locationId: userForm.locationId ? Number(userForm.locationId) : null, managerId: userForm.managerId ? Number(userForm.managerId) : null }
      await fetchJson('/api/users', { method: 'POST', body: JSON.stringify(payload) })
      setActionStatus({ type: 'success', message: 'User created successfully.' })
      setUserForm(initialUserForm)
      setShowUserModal(false)
      await loadUsers()
    } catch (error) { setActionStatus({ type: 'error', message: `Create user failed: ${error.message}` }) }
  }

  const handleCreateDevice = async () => {
    try {
      if (!deviceForm.ownerUserId) throw new Error('Owner user is required')
      if (!deviceForm.name.trim() || !deviceForm.phoneNumber.trim()) throw new Error('Device name and phone number are required')
      const payload = { name: deviceForm.name.trim(), phoneNumber: deviceForm.phoneNumber.trim(), locationId: deviceForm.locationId ? Number(deviceForm.locationId) : null, ownerUserId: Number(deviceForm.ownerUserId) }
      await fetchJson('/api/devices', { method: 'POST', body: JSON.stringify(payload) })
      setActionStatus({ type: 'success', message: 'Device created successfully.' })
      setDeviceForm(initialDeviceForm)
      setShowDeviceModal(false)
      await loadDevices()
    } catch (error) { setActionStatus({ type: 'error', message: `Create device failed: ${error.message}` }) }
  }

  return (
    <div className="dashboard-frame">
      <header className="dashboard-topbar">
        <div className="brand">EV12 LOGO</div>
        <div className="profile">
          <div>
            <strong>{user?.firstName || "Jane"} {user?.lastName || "Doe"}</strong>
            <small>Super Admin</small>
          </div>
          <span className="avatar-dot" />
        </div>
      </header>

      <div className="home-shell">
        <Sidebar activeSection={activeSection} onChangeSection={setActiveSection} onLogout={onLogout} />

        <div className="dashboard-content">
        {dataStatus ? <p className="status">{dataStatus}</p> : null}
        {actionStatus.message ? <p className={actionStatus.type === 'error' ? 'status-error' : 'status-success'}>{actionStatus.message}</p> : null}

        {activeSection === 'dashboard' && (
          <>
            <h2 className="page-title">Dashboard</h2>
            <section className="metric-grid">
              {metrics.map((metric) => (
                <article key={metric.label} className="metric-card">
                  <div className="metric-icon" />
                  <div>
                    <p>{metric.label}</p>
                    <h3>{Number(metric.value || 0)}</h3>
                  </div>
                </article>
              ))}
            </section>

            <section className="dashboard-main-grid">
              <article className="device-overview card-like">
                <h3>Device Overview</h3>
                <div className="device-panel">
                  <div className="device-photo-placeholder" />
                  <dl>
                    {deviceRows.map(([label, value]) => (
                      <div className="device-row" key={label}><dt>{label}</dt><dd>{value}</dd></div>
                    ))}
                  </dl>
                </div>
              </article>

              <aside className="action-stack card-like">
                <button disabled={loading} onClick={sendConfig}>Send Command</button>
                <button disabled={loading} onClick={sendMessage}>Request Location</button>
                <button disabled={loading} onClick={fetchReplies}>Fetch Replies</button>
              </aside>
            </section>
          </>
        )}

        {activeSection === 'users' && (
          <section className="card-like section-panel">
            <div className="section-head">
              <h2 className="section-title">Users</h2>
              <button className="mini-action" onClick={async () => { await Promise.all([loadLocations(), loadUsers()]); setShowUserModal(true) }}>+ Create User</button>
            </div>
            <table className="data-table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Contact</th><th>Location</th><th>Manager</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id || u.email}>
                    <td>{`${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name || '-'}</td>
                    <td>{u.email || '-'}</td>
                    <td>{u.userRole || u.role || '-'}</td>
                    <td>{u.contactNumber || '-'}</td>
                    <td>{u.locationName || u.location?.name || '-'}</td>
                    <td>{u.managerName || u.manager?.firstName || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {activeSection === 'locations' && (
          <section className="card-like section-panel">
            <div className="section-head">
              <h2 className="section-title">Locations</h2>
              <button className="mini-action" onClick={() => setShowLocationModal(true)}>+ Create Location</button>
            </div>
            <table className="data-table">
              <thead><tr><th>Name</th><th>Details</th><th>User Count</th><th>Device Count</th></tr></thead>
              <tbody>
                {locations.map((l) => (
                  <tr key={l.id || l.name}>
                    <td>{l.name || '-'}</td>
                    <td>{l.details || '-'}</td>
                    <td>{l.userCount || l.users?.length || 0}</td>
                    <td>{l.deviceCount || l.devices?.length || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {activeSection === 'devices' && (
          <section className="card-like section-panel">
            <div className="section-head">
              <h2 className="section-title">Devices</h2>
              <button className="mini-action" onClick={async () => { await Promise.all([loadUsers(), loadLocations()]); setShowDeviceModal(true) }}>+ Add Device</button>
            </div>
            <table className="data-table">
              <thead><tr><th>Device</th><th>Phone</th><th>Owner</th><th>Role</th><th>Location</th><th>Action</th></tr></thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.id || d.phoneNumber || d.name}>
                    <td>{d.name || d.deviceName || '-'}</td>
                    <td>{d.phoneNumber || '-'}</td>
                    <td>{d.ownerName || d.owner?.firstName || '-'}</td>
                    <td>{d.ownerRole || d.owner?.userRole || '-'}</td>
                    <td>{d.locationName || d.owner?.location?.name || '-'}</td>
                    <td><button className="table-link" type="button" onClick={() => openDeviceSettings(d)}>Open Settings</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {activeSection === 'settings-basic' && (
          <section className="card-like section-panel">
            <h2 className="section-title">Settings &gt; Basic Configuration</h2>
            {selectedDevice ? <p className="status-success">Editing {selectedDevice.name || selectedDevice.deviceName}.</p> : <p className="status">Select a device from Devices list to configure.</p>}
            <div className="field-grid two-col">
              <div><label>IMEI</label><input value={configForm.imei} readOnly /></div>
              <div><label>Device Name / Identity</label><input value={configForm.prefixName} onChange={(event) => setConfigForm((prev) => ({ ...prev, prefixName: event.target.value }))} /></div>
            </div>
            <h3 className="block-title">Contact Information</h3>
            <div className="contact-table"><div className="contact-head"><span>Contact</span><span>Name</span><span>Contact Number</span><span>SMS</span><span>Call</span><span /></div><div className="contact-row"><span className="chip">Contact 1</span><span>{configForm.contactName || 'John Doe'}</span><span>{configForm.contactNumber || '+639198765432'}</span><span>{configForm.contactSmsEnabled ? 'On' : 'Off'}</span><span>{configForm.contactCallEnabled ? 'On' : 'Off'}</span><span>✎ 🗑</span></div></div>
            <div className="field-grid two-col footer-config"><div><label>SMS Password</label><input value={configForm.smsPassword} onChange={(event) => setConfigForm((prev) => ({ ...prev, smsPassword: event.target.value }))} /></div><div><label>SMS White List</label><label className="switch-row"><input type="checkbox" checked={configForm.smsWhitelistEnabled} onChange={() => toggle('smsWhitelistEnabled')} /><span>{configForm.smsWhitelistEnabled ? 'On' : 'Off'}</span></label></div></div>
          </section>
        )}

        {activeSection === 'settings-alarm' && (
          <section className="card-like section-panel">
            <h2 className="section-title">Settings &gt; Alarm Settings</h2>
            {selectedDevice ? <p className="status-success">Alarm settings for {selectedDevice.name || selectedDevice.deviceName}.</p> : <p className="status">Select a device from Devices list to configure alarms.</p>}
            <div className="alarm-card"><h3>SOS Action</h3><div className="alarm-row"><label>Mode</label><select value={configForm.sosMode} onChange={(event) => setConfigForm((prev) => ({ ...prev, sosMode: event.target.value }))}><option value="1">Long Press</option><option value="2">Double Click</option></select><label>Action Time</label><input type="range" min="5" max="60" value={configForm.sosActionTime} onChange={(event) => setConfigForm((prev) => ({ ...prev, sosActionTime: event.target.value }))} /></div></div>
            <div className="alarm-card"><h3>Fall Detection</h3><div className="alarm-row"><label>Enable</label><label className="switch-row"><input type="checkbox" checked={configForm.fallDownEnabled === '1'} onChange={() => setConfigForm((prev) => ({ ...prev, fallDownEnabled: prev.fallDownEnabled === '1' ? '0' : '1' }))} /><span>{configForm.fallDownEnabled === '1' ? 'On' : 'Off'}</span></label><label>Sensitivity</label><input type="range" min="1" max="9" value={configForm.fallDownSensitivity} onChange={(event) => setConfigForm((prev) => ({ ...prev, fallDownSensitivity: event.target.value }))} /></div></div>
            <div className="alarm-card"><h3>Motion / No Motion</h3><div className="alarm-row"><label>Enable</label><label className="switch-row"><input type="checkbox" checked={configForm.motionEnabled === '1'} onChange={() => setConfigForm((prev) => ({ ...prev, motionEnabled: prev.motionEnabled === '1' ? '0' : '1' }))} /><span>{configForm.motionEnabled === '1' ? 'On' : 'Off'}</span></label><label>Duration</label><input value={configForm.motionDurationTime} onChange={(event) => setConfigForm((prev) => ({ ...prev, motionDurationTime: event.target.value }))} /></div></div>
          </section>
        )}

        {activeSection === 'location' && (
          <section className="section-panel">
            <h2 className="page-title">Location</h2>
            <article className="card-like map-panel">
              {locationResult ? (
                <>
                  <div className="map-placeholder map-embed-wrap">
                    <iframe
                      title="Device location map"
                      className="map-embed"
                      src={`https://maps.google.com/maps?q=${locationResult.latitude},${locationResult.longitude}&z=15&output=embed`}
                    />
                  </div>
                  <div className="location-meta">
                    <span className="map-chip">Lat: {locationResult.latitude} Lon: {locationResult.longitude}</span>
                    <a href={locationResult.mapUrl} target="_blank" rel="noreferrer">Open in Google Maps</a>
                  </div>
                  <pre className="preview-box">{locationResult.rawMessage}</pre>
                </>
              ) : (
                <div className="map-placeholder"><span className="map-chip">No location reply yet. Click request to send Loc.</span></div>
              )}
              <button className="mini-action request-btn" disabled={loading} onClick={requestLocationUpdate}>Request Location (Loc)</button>
              <p className="status">{status}</p>
            </article>
          </section>
        )}

        {activeSection === 'commands' && (
          <section>
            <h2 className="page-title">Command Page</h2>
            <div className="commands-layout">
              <article className="card-like"><h3>Command Input</h3><div className="field-grid"><div><label>Contact Number</label><input value={configForm.contactNumber} onChange={(event) => setConfigForm((prev) => ({ ...prev, contactNumber: event.target.value }))} /></div><div><label>SOS Action</label><input value={configForm.sosActionTime} onChange={(event) => setConfigForm((prev) => ({ ...prev, sosActionTime: event.target.value }))} /></div><div><label>Geo-fence</label><input value={configForm.geoFenceRadius} onChange={(event) => setConfigForm((prev) => ({ ...prev, geoFenceRadius: event.target.value }))} /></div></div><button className="mini-action" disabled={loading} onClick={sendConfig}>Send Command</button></article>
              <article className="card-like"><h3>Command Preview</h3><pre className="preview-box">{commandPreview || 'No command generated yet.'}</pre><button className="mini-action" disabled={loading} onClick={sendConfig}>Submit</button></article>
            </div>
            <article className="card-like gateway-panel"><h3>SMS Gateway + Test Message</h3><div className="field-grid two-col"><div><label>Gateway Base URL</label><input placeholder="https://gateway-url" value={gatewayBaseUrl} onChange={(event) => setGatewayBaseUrl(event.target.value)} /></div><div><label>Gateway Token</label><input placeholder="Authorization token" value={gatewayToken} onChange={(event) => setGatewayToken(event.target.value)} /></div><div><label>Test Phone Number</label><input value={phone} onChange={(event) => setPhone(event.target.value)} /></div><div><label>Custom Message</label><input value={message} onChange={(event) => setMessage(event.target.value)} /></div></div><button className="mini-action" disabled={loading} onClick={sendMessage}>Send Test Message</button><div className="status">{status}</div><div className="status">{configStatus}</div>{configResult ? <pre className="replies conversation-box">{JSON.stringify(configResult, null, 2)}</pre> : null}</article>
          </section>
        )}

        {activeSection === 'replies' && (
          <section className="card-like section-panel">
            <h2 className="section-title">Replies</h2>
            <div className="section-head">
              <button className="mini-action" disabled={loading} onClick={fetchReplies}>Manual Refresh</button>
              <button className="mini-action" type="button" onClick={() => setAutoFetchReplies((prev) => !prev)}>
                {autoFetchReplies ? 'Stop Auto Refresh' : 'Start Auto Refresh (5s)'}
              </button>
            </div>
            <p className="status">{autoFetchReplies ? 'Auto refresh is running every 5 seconds.' : 'Auto refresh is off.'}</p>
            <pre className="replies conversation-box">{formattedReplies}</pre>
          </section>
        )}

        {activeSection === 'webhooks' && (
          <section className="card-like section-panel">
            <div className="section-head">
              <h2 className="section-title">Webhook Events</h2>
              <div>
                <button className="mini-action" type="button" onClick={loadWebhookEvents}>Refresh Events</button>
                <button className="mini-action" type="button" onClick={clearWebhookEvents}>Clear Events</button>
              </div>
            </div>
            <p className="status">Live listener is active. New events appear automatically. Showing latest 3 events.</p>
            <p className="status">{webhookStatus || 'No webhook data loaded yet.'}</p>

            <div className="webhook-list">
              {webhookRaw === null ? (
                <pre className="conversation-box webhook-pre">No webhook events found.</pre>
              ) : Array.isArray(webhookRaw) ? (
                webhookRaw.map((event, index) => {
                  const parts = splitWebhookParts(event)
                  return (
                    <article className="webhook-event" key={event?.id || event?._id || `${parts.timestamp || 'event'}-${index}`}>
                      {parts.timestamp ? <h3 className="webhook-time">{String(parts.timestamp)}</h3> : null}
                      {parts.headers !== null && parts.headers !== undefined ? (
                        <>
                          <h4>Headers</h4>
                          <pre className="conversation-box webhook-pre">{renderRaw(parts.headers)}</pre>
                        </>
                      ) : null}
                      <h4>Payload</h4>
                      <pre className="conversation-box webhook-pre">{renderRaw(parts.payload ?? parts.rawEvent)}</pre>
                    </article>
                  )
                })
              ) : (
                <article className="webhook-event">
                  <h4>Payload</h4>
                  <pre className="conversation-box webhook-pre">{renderRaw(webhookRaw)}</pre>
                </article>
              )}
            </div>
          </section>
        )}
      </div>

      {showUserModal && <div className="overlay" onClick={() => setShowUserModal(false)}><div className="modal" onClick={(e) => e.stopPropagation()}><h3>Create User</h3><div className="field-grid two-col"><input placeholder="First Name" value={userForm.firstName} onChange={(e) => setUserForm((p) => ({ ...p, firstName: e.target.value }))} /><input placeholder="Last Name" value={userForm.lastName} onChange={(e) => setUserForm((p) => ({ ...p, lastName: e.target.value }))} /><input placeholder="Email" value={userForm.email} onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))} /><input type="password" placeholder="Password" value={userForm.password} onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))} /><input placeholder="Address" value={userForm.address} onChange={(e) => setUserForm((p) => ({ ...p, address: e.target.value }))} /><input placeholder="Phone Number" value={userForm.contactNumber} onChange={(e) => setUserForm((p) => ({ ...p, contactNumber: e.target.value }))} /><select value={userForm.locationId} onChange={(e) => setUserForm((p) => ({ ...p, locationId: e.target.value }))}><option value="">Location (Optional)</option>{locations.map((l) => <option key={l.id || l.name} value={l.id || ''}>{l.name || 'Unknown location'}</option>)}</select><select value={userForm.userRole} onChange={(e) => setUserForm((p) => ({ ...p, userRole: Number(e.target.value) }))}><option value={3}>User</option><option value={2}>Manager</option><option value={1}>Super Admin</option></select><select value={userForm.managerId} onChange={(e) => setUserForm((p) => ({ ...p, managerId: e.target.value }))}><option value="">Manager</option>{managers.map((m) => <option key={m.id || m.email} value={m.id || ''}>{`${m.firstName || ''} ${m.lastName || ''}`.trim() || m.email}</option>)}</select></div><div className="modal-actions"><button className="ghost" onClick={() => setShowUserModal(false)}>Cancel</button><button className="mini-action" onClick={handleCreateUser}>Create Account</button></div></div></div>}

      {showLocationModal && <div className="overlay" onClick={() => setShowLocationModal(false)}><div className="modal small" onClick={(e) => e.stopPropagation()}><h3>Create Location</h3><div className="field-grid"><input placeholder="Location Name" value={locationForm.name} onChange={(e) => setLocationForm((p) => ({ ...p, name: e.target.value }))} /><textarea rows={3} placeholder="Details" value={locationForm.details} onChange={(e) => setLocationForm((p) => ({ ...p, details: e.target.value }))} /></div><div className="modal-actions"><button className="ghost" onClick={() => setShowLocationModal(false)}>Cancel</button><button className="mini-action" onClick={handleCreateLocation}>Create Location</button></div></div></div>}

      {showDeviceModal ? (
        <div className="overlay" onClick={() => setShowDeviceModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>Add Device</h3>
            <div className="field-grid">
              <input placeholder="Device Name" value={deviceForm.name} onChange={(event) => setDeviceForm((prev) => ({ ...prev, name: event.target.value }))} />
              <input placeholder="Phone Number" value={deviceForm.phoneNumber} onChange={(event) => setDeviceForm((prev) => ({ ...prev, phoneNumber: event.target.value }))} />
              <select value={deviceForm.ownerUserId} onChange={(event) => setDeviceForm((prev) => ({ ...prev, ownerUserId: event.target.value }))}><option value="">Select User</option>{users.map((user) => <option key={user.id || user.email} value={user.id || ''}>{`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email}</option>)}</select>
              <select value={deviceForm.locationId} onChange={(event) => setDeviceForm((prev) => ({ ...prev, locationId: event.target.value }))}><option value="">Location (Optional)</option>{locations.map((location) => <option key={location.id || location.name} value={location.id || ''}>{location.name || 'Unknown location'}</option>)}</select>
            </div>
            <button className="mini-action" onClick={handleCreateDevice}>Add Device</button>
          </div>
        </div>
      ) : null}
      </div>
    </div>
  )
}
