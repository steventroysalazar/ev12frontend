import { useState } from 'react'
import Sidebar from '../../components/sidebar/Sidebar'
import './home.css'

const metrics = [
  { label: 'TOTAL USERS', value: '200' },
  { label: 'TOTAL DEVICES', value: '683' },
  { label: 'TOTAL LOCATIONS', value: '42' },
  { label: 'RECENT REPLIES', value: '28' }
]

const deviceRows = [
  ['Device Name', 'Lorem - EV12'],
  ['Device Phone Number', '+639108653532'],
  ['Owner User', 'John Doe'],
  ['Owner Location', 'Sydney, Australia'],
  ['Last reply', '04-03-2026 23:15'],
  ['Battery status', '74%']
]

const users = [
  ['John Doe', 'john@ev12.com', 'User', '+639198765432', 'Sydney', 'Jane Doe', '2'],
  ['Mark Wayne', 'mark@ev12.com', 'Manager', '+639123456789', 'Perth', '-', '3']
]

const locations = [
  ['Sydney', 'Head office', '36', '124'],
  ['Perth', 'West region', '19', '52']
]

const devices = [
  ['Lorem-EV12', '+639108653532', 'John Doe', 'User', 'Sydney'],
  ['Tracker-12', '+639176543210', 'Mark Wayne', 'Manager', 'Perth']
]

const replies = [
  ['2026-03-04 23:15', '+639108653532', 'GPS Loc! Battery 74%'],
  ['2026-03-04 23:17', '+639176543210', 'status: online']
]

export default function HomeView({
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
  status,
  formattedReplies
}) {
  const [activeSection, setActiveSection] = useState('dashboard')
  const [showUserModal, setShowUserModal] = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [showDeviceModal, setShowDeviceModal] = useState(false)

  const toggle = (key) => setConfigForm((prev) => ({ ...prev, [key]: !prev[key] }))

  return (
    <div className="home-shell">
      <Sidebar activeSection={activeSection} onChangeSection={setActiveSection} />

      <div className="dashboard-content">
        {activeSection === 'dashboard' && (
          <>
            <h2 className="page-title">Dashboard</h2>
            <section className="metric-grid">
              {metrics.map((metric) => (
                <article key={metric.label} className="metric-card">
                  <div className="metric-icon" />
                  <div>
                    <p>{metric.label}</p>
                    <h3>{metric.value}</h3>
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
                      <div className="device-row" key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
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
            <div className="section-head"><h2 className="section-title">Users</h2><button className="mini-action" onClick={() => setShowUserModal(true)}>+ Create User</button></div>
            <table className="data-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Contact</th><th>Location</th><th>Manager</th><th>Devices</th></tr></thead><tbody>{users.map((r) => <tr key={r[1]}>{r.map((c) => <td key={`${r[1]}-${c}`}>{c}</td>)}</tr>)}</tbody></table>
          </section>
        )}

        {activeSection === 'locations' && (
          <section className="card-like section-panel">
            <div className="section-head"><h2 className="section-title">Locations</h2><button className="mini-action" onClick={() => setShowLocationModal(true)}>+ Create Location</button></div>
            <table className="data-table"><thead><tr><th>Name</th><th>Details</th><th>User Count</th><th>Device Count</th></tr></thead><tbody>{locations.map((r) => <tr key={r[0]}>{r.map((c) => <td key={`${r[0]}-${c}`}>{c}</td>)}</tr>)}</tbody></table>
          </section>
        )}

        {activeSection === 'devices' && (
          <section className="card-like section-panel">
            <div className="section-head"><h2 className="section-title">Devices</h2><button className="mini-action" onClick={() => setShowDeviceModal(true)}>+ Add Device</button></div>
            <table className="data-table"><thead><tr><th>Device</th><th>Phone</th><th>Owner</th><th>Owner Role</th><th>Location</th></tr></thead><tbody>{devices.map((r) => <tr key={r[0]}>{r.map((c) => <td key={`${r[0]}-${c}`}>{c}</td>)}</tr>)}</tbody></table>
          </section>
        )}

        {activeSection === 'settings-basic' && (
          <section className="card-like section-panel">
            <h2 className="section-title">Settings &gt; Basic Configuration</h2>
            <div className="field-grid two-col">
              <div><label>IMEI</label><input value={configForm.imei} readOnly /></div>
              <div><label>Device Name / Identity</label><input value={configForm.prefixName} onChange={(event) => setConfigForm((prev) => ({ ...prev, prefixName: event.target.value }))} /></div>
            </div>

            <h3 className="block-title">Contact Information</h3>
            <div className="contact-table">
              <div className="contact-head"><span>Contact</span><span>Name</span><span>Contact Number</span><span>SMS</span><span>Call</span><span /></div>
              <div className="contact-row"><span className="chip">Contact 1</span><span>{configForm.contactName || 'John Doe'}</span><span>{configForm.contactNumber || '+639198765432'}</span><span>{configForm.contactSmsEnabled ? 'On' : 'Off'}</span><span>{configForm.contactCallEnabled ? 'On' : 'Off'}</span><span>✎ 🗑</span></div>
            </div>

            <div className="field-grid two-col footer-config">
              <div><label>SMS Password</label><input value={configForm.smsPassword} onChange={(event) => setConfigForm((prev) => ({ ...prev, smsPassword: event.target.value }))} /></div>
              <div>
                <label>SMS White List</label>
                <label className="switch-row"><input type="checkbox" checked={configForm.smsWhitelistEnabled} onChange={() => toggle('smsWhitelistEnabled')} /><span>{configForm.smsWhitelistEnabled ? 'On' : 'Off'}</span></label>
              </div>
            </div>
          </section>
        )}

        {activeSection === 'settings-alarm' && (
          <section className="card-like section-panel">
            <h2 className="section-title">Settings &gt; Alarm Settings</h2>
            <div className="alarm-card"><h3>SOS Action</h3><div className="alarm-row"><label>Mode</label><select value={configForm.sosMode} onChange={(event) => setConfigForm((prev) => ({ ...prev, sosMode: event.target.value }))}><option value="1">Long Press</option><option value="2">Double Click</option></select><label>Action Time</label><input type="range" min="5" max="60" value={configForm.sosActionTime} onChange={(event) => setConfigForm((prev) => ({ ...prev, sosActionTime: event.target.value }))} /></div></div>
            <div className="alarm-card"><h3>Fall Detection</h3><div className="alarm-row"><label>Enable</label><label className="switch-row"><input type="checkbox" checked={configForm.fallDownEnabled === '1'} onChange={() => setConfigForm((prev) => ({ ...prev, fallDownEnabled: prev.fallDownEnabled === '1' ? '0' : '1' }))} /><span>{configForm.fallDownEnabled === '1' ? 'On' : 'Off'}</span></label><label>Sensitivity</label><input type="range" min="1" max="9" value={configForm.fallDownSensitivity} onChange={(event) => setConfigForm((prev) => ({ ...prev, fallDownSensitivity: event.target.value }))} /></div></div>
            <div className="alarm-card"><h3>Motion / No Motion</h3><div className="alarm-row"><label>Enable</label><label className="switch-row"><input type="checkbox" checked={configForm.motionEnabled === '1'} onChange={() => setConfigForm((prev) => ({ ...prev, motionEnabled: prev.motionEnabled === '1' ? '0' : '1' }))} /><span>{configForm.motionEnabled === '1' ? 'On' : 'Off'}</span></label><label>Duration</label><input value={configForm.motionDurationTime} onChange={(event) => setConfigForm((prev) => ({ ...prev, motionDurationTime: event.target.value }))} /></div></div>
            <div className="alarm-card"><h3>Over-speed</h3><div className="alarm-row"><label>Enable</label><label className="switch-row"><input type="checkbox" checked={configForm.overSpeedEnabled === '1'} onChange={() => setConfigForm((prev) => ({ ...prev, overSpeedEnabled: prev.overSpeedEnabled === '1' ? '0' : '1' }))} /><span>{configForm.overSpeedEnabled === '1' ? 'On' : 'Off'}</span></label><label>Speed Limit</label><input value={configForm.overSpeedLimit} onChange={(event) => setConfigForm((prev) => ({ ...prev, overSpeedLimit: event.target.value }))} /></div></div>
            <div className="alarm-card"><h3>Geo-fence</h3><div className="alarm-row"><label>Enable</label><label className="switch-row"><input type="checkbox" checked={configForm.geoFenceEnabled === '1'} onChange={() => setConfigForm((prev) => ({ ...prev, geoFenceEnabled: prev.geoFenceEnabled === '1' ? '0' : '1' }))} /><span>{configForm.geoFenceEnabled === '1' ? 'On' : 'Off'}</span></label><label>Fence Mode</label><select value={configForm.geoFenceMode} onChange={(event) => setConfigForm((prev) => ({ ...prev, geoFenceMode: event.target.value }))}><option value="0">Leave</option><option value="1">Enter</option></select></div></div>
          </section>
        )}

        {activeSection === 'location' && (
          <section className="section-panel">
            <h2 className="page-title">Location</h2>
            <article className="card-like map-panel">
              <div className="map-placeholder"><span className="map-chip">Lat: -33.8698439 Lon: 151.2082848</span></div>
              <button className="mini-action request-btn" disabled={loading} onClick={sendMessage}>Request Location</button>
            </article>
            <div className="location-grid">
              <article className="card-like"><h3>Continuous Tracking</h3><div className="field-grid"><label>Enable</label><label className="switch-row"><input type="checkbox" checked={configForm.requestLocation} onChange={() => toggle('requestLocation')} /><span>{configForm.requestLocation ? 'On' : 'Off'}</span></label><label>Interval</label><select value={configForm.continuousLocateInterval} onChange={(event) => setConfigForm((prev) => ({ ...prev, continuousLocateInterval: event.target.value }))}><option>10s</option><option>30s</option><option>1m</option></select><label>Duration</label><input value={configForm.continuousLocateDuration} onChange={(event) => setConfigForm((prev) => ({ ...prev, continuousLocateDuration: event.target.value }))} /></div></article>
              <article className="card-like"><h3>Geo-fence Settings</h3><div className="field-grid"><label>Enable</label><label className="switch-row"><input type="checkbox" checked={configForm.geoFenceEnabled === '1'} onChange={() => setConfigForm((prev) => ({ ...prev, geoFenceEnabled: prev.geoFenceEnabled === '1' ? '0' : '1' }))} /><span>{configForm.geoFenceEnabled === '1' ? 'On' : 'Off'}</span></label><label>Radius</label><input value={configForm.geoFenceRadius} onChange={(event) => setConfigForm((prev) => ({ ...prev, geoFenceRadius: event.target.value }))} /><label>Action</label><select value={configForm.geoFenceMode} onChange={(event) => setConfigForm((prev) => ({ ...prev, geoFenceMode: event.target.value }))}><option value="0">Leave</option><option value="1">Enter</option></select></div></article>
            </div>
          </section>
        )}

        {activeSection === 'commands' && (
          <section>
            <h2 className="page-title">Command Page</h2>
            <div className="commands-layout">
              <article className="card-like">
                <h3>Command Input</h3>
                <div className="field-grid">
                  <div><label>Contact Number</label><input value={configForm.contactNumber} onChange={(event) => setConfigForm((prev) => ({ ...prev, contactNumber: event.target.value }))} /></div>
                  <div><label>SOS Action</label><input value={configForm.sosActionTime} onChange={(event) => setConfigForm((prev) => ({ ...prev, sosActionTime: event.target.value }))} /></div>
                  <div><label>Geo-fence</label><input value={configForm.geoFenceRadius} onChange={(event) => setConfigForm((prev) => ({ ...prev, geoFenceRadius: event.target.value }))} /></div>
                </div>
                <button className="mini-action" disabled={loading} onClick={sendConfig}>Send Command</button>
              </article>

              <article className="card-like">
                <h3>Command Preview</h3>
                <pre className="preview-box">{commandPreview || 'No command generated yet.'}</pre>
                <button className="mini-action" disabled={loading} onClick={sendConfig}>Submit</button>
              </article>
            </div>

            <article className="card-like gateway-panel">
              <h3>SMS Gateway + Test Message</h3>
              <div className="field-grid two-col">
                <div><label>Gateway Base URL</label><input placeholder="https://gateway-url" value={gatewayBaseUrl} onChange={(event) => setGatewayBaseUrl(event.target.value)} /></div>
                <div><label>Gateway Token</label><input placeholder="Authorization token" value={gatewayToken} onChange={(event) => setGatewayToken(event.target.value)} /></div>
                <div><label>Test Phone Number</label><input value={phone} onChange={(event) => setPhone(event.target.value)} /></div>
                <div><label>Custom Message</label><input value={message} onChange={(event) => setMessage(event.target.value)} /></div>
              </div>
              <button className="mini-action" disabled={loading} onClick={sendMessage}>Send Test Message</button>
              <div className="status">{status}</div>
              <div className="status">{configStatus}</div>
              {configResult ? <pre className="replies conversation-box">{JSON.stringify(configResult, null, 2)}</pre> : null}
            </article>
          </section>
        )}

        {activeSection === 'replies' && (
          <section className="card-like section-panel">
            <h2 className="section-title">Replies</h2>
            <table className="data-table"><thead><tr><th>Received At</th><th>From</th><th>Message</th></tr></thead><tbody>{replies.map((r) => <tr key={`${r[0]}${r[1]}`}>{r.map((c) => <td key={`${r[0]}-${c}`}>{c}</td>)}</tr>)}</tbody></table>
            <button className="mini-action" disabled={loading} onClick={fetchReplies}>Manual Refresh</button>
            <pre className="replies conversation-box">{formattedReplies}</pre>
          </section>
        )}
      </div>

      {showUserModal ? (
        <div className="overlay" onClick={() => setShowUserModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>Create User</h3>
            <div className="field-grid two-col"><input placeholder="First Name" /><input placeholder="Last Name" /><input placeholder="Email" /><input placeholder="Password" /><input placeholder="Contact Number" /><select><option>User</option><option>Manager</option><option>Super Admin</option></select><input placeholder="Location" /><input placeholder="Manager (required for role 3)" /></div>
            <button className="mini-action" onClick={() => setShowUserModal(false)}>Create</button>
          </div>
        </div>
      ) : null}

      {showLocationModal ? (
        <div className="overlay" onClick={() => setShowLocationModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>Create Location</h3>
            <div className="field-grid"><input placeholder="Location Name" /><textarea rows={3} placeholder="Details" /></div>
            <button className="mini-action" onClick={() => setShowLocationModal(false)}>Create</button>
          </div>
        </div>
      ) : null}

      {showDeviceModal ? (
        <div className="overlay" onClick={() => setShowDeviceModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>Add Device</h3>
            <div className="field-grid"><input placeholder="Device Name" /><input placeholder="Phone Number" /><input placeholder="Owner User" /></div>
            <button className="mini-action" onClick={() => setShowDeviceModal(false)}>Add Device</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
