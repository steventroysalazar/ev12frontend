import { useMemo, useState } from 'react'
import Sidebar from '../../components/sidebar/Sidebar'
import './home.css'

const users = [
  ['Markwayne', 'mark@mail.com', 'User', '+639111111111', 'Sydney, AU', 'Mark Wayne'],
  ['Karen Anne', 'karen@mail.com', 'User', '+639122222222', 'Sydney, AU', 'Mark Wayne'],
  ['John Doe', 'john@mail.com', 'Super Admin', '+639133333333', 'Sydney, AU', 'N/A']
]

const locations = [
  ['Sydney, Australia', 'Lorem ipsum dolor sit amet', '35', '104'],
  ['Melbourne, Australia', 'Lorem ipsum dolor sit amet', '26', '94']
]

const devices = [
  ['LOREM-EV12', '+63 917 111 111', 'Markwayne', 'Manager', 'Sydney, Australia'],
  ['LOREM-CT12', '+63 917 222 222', 'Karen Anne', 'User', 'Melbourne, Australia']
]

const repliesRows = [
  ['2026-03-03 04:20', '+63 917 111 111', 'Hi there', 'received'],
  ['2026-03-03 04:32', '+63 917 222 222', 'Location updated', 'received']
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
  const [activeSection, setActiveSection] = useState('settings-basic')

  const headerTitle = useMemo(() => {
    if (activeSection.startsWith('settings')) return 'Settings'
    if (activeSection === 'commands') return 'Command Page'
    return activeSection.charAt(0).toUpperCase() + activeSection.slice(1)
  }, [activeSection])

  return (
    <div className="home-shell">
      <Sidebar activeSection={activeSection} onChangeSection={setActiveSection} />

      <div className="dashboard-content">
        <section className="dashboard-header-row">
          <h2>{headerTitle}</h2>
        </section>

        {activeSection === 'settings-basic' && (
          <section className="card-like settings-panel">
            <h3>Settings &gt; Basic Configuration</h3>
            <div className="field-grid two-col">
              <div>
                <label>Device ID</label>
                <input value={configForm.deviceId} onChange={(event) => setConfigForm((prev) => ({ ...prev, deviceId: event.target.value }))} />
              </div>
              <div>
                <label>Device Name</label>
                <input value={configForm.contactName} onChange={(event) => setConfigForm((prev) => ({ ...prev, contactName: event.target.value }))} />
              </div>
            </div>

            <h4>Contact Information</h4>
            <div className="field-grid four-col">
              <div>
                <label>Contact Number</label>
                <input value={configForm.contactNumber} onChange={(event) => setConfigForm((prev) => ({ ...prev, contactNumber: event.target.value }))} />
              </div>
              <div>
                <label>Name</label>
                <input value={configForm.contactName} onChange={(event) => setConfigForm((prev) => ({ ...prev, contactName: event.target.value }))} />
              </div>
              <div>
                <label>SMS</label>
                <select value={configForm.contactSmsEnabled ? '1' : '0'} onChange={(event) => setConfigForm((prev) => ({ ...prev, contactSmsEnabled: event.target.value === '1' }))}>
                  <option value="1">On</option><option value="0">Off</option>
                </select>
              </div>
              <div>
                <label>Call</label>
                <select value={configForm.contactCallEnabled ? '1' : '0'} onChange={(event) => setConfigForm((prev) => ({ ...prev, contactCallEnabled: event.target.value === '1' }))}>
                  <option value="1">On</option><option value="0">Off</option>
                </select>
              </div>
            </div>

            <div className="field-grid two-col">
              <div>
                <label>SMS Password</label>
                <input value={configForm.smsPassword} onChange={(event) => setConfigForm((prev) => ({ ...prev, smsPassword: event.target.value }))} />
              </div>
              <div>
                <label>SMS Whitelist</label>
                <select value={configForm.smsWhitelistEnabled ? '1' : '0'} onChange={(event) => setConfigForm((prev) => ({ ...prev, smsWhitelistEnabled: event.target.value === '1' }))}>
                  <option value="1">On</option><option value="0">Off</option>
                </select>
              </div>
            </div>
          </section>
        )}

        {activeSection === 'settings-alarm' && (
          <section className="card-like settings-panel">
            <h3>Settings &gt; Alarm Settings</h3>
            <div className="alarm-row"><label>SOS Mode</label><input value={configForm.sosMode} onChange={(event) => setConfigForm((prev) => ({ ...prev, sosMode: event.target.value }))} /><label>Action Time</label><input value={configForm.sosActionTime} onChange={(event) => setConfigForm((prev) => ({ ...prev, sosActionTime: event.target.value }))} /></div>
            <div className="alarm-row"><label>Fall Detection</label><select value={configForm.fallDownEnabled} onChange={(event) => setConfigForm((prev) => ({ ...prev, fallDownEnabled: event.target.value }))}><option value="1">Enable</option><option value="0">Disable</option></select><label>Sensitivity</label><input value={configForm.fallDownSensitivity} onChange={(event) => setConfigForm((prev) => ({ ...prev, fallDownSensitivity: event.target.value }))} /></div>
            <div className="alarm-row"><label>Over-speed</label><select value={configForm.overSpeedEnabled} onChange={(event) => setConfigForm((prev) => ({ ...prev, overSpeedEnabled: event.target.value }))}><option value="1">Enable</option><option value="0">Disable</option></select><label>Speed Limit</label><input value={configForm.overSpeedLimit} onChange={(event) => setConfigForm((prev) => ({ ...prev, overSpeedLimit: event.target.value }))} /></div>
            <div className="alarm-row"><label>Geo-fence</label><select value={configForm.geoFenceEnabled} onChange={(event) => setConfigForm((prev) => ({ ...prev, geoFenceEnabled: event.target.value }))}><option value="1">Enable</option><option value="0">Disable</option></select><label>Radius</label><input value={configForm.geoFenceRadius} onChange={(event) => setConfigForm((prev) => ({ ...prev, geoFenceRadius: event.target.value }))} /></div>
          </section>
        )}

        {activeSection === 'commands' && (
          <section className="commands-layout">
            <article className="card-like">
              <h3>Command Input</h3>
              <div className="field-grid">
                <div><label>Contact Number</label><input value={configForm.contactNumber} onChange={(event) => setConfigForm((prev) => ({ ...prev, contactNumber: event.target.value }))} /></div>
                <div><label>SOS Action</label><input value={configForm.sosActionTime} onChange={(event) => setConfigForm((prev) => ({ ...prev, sosActionTime: event.target.value }))} /></div>
                <div><label>Geo-fence Radius</label><input value={configForm.geoFenceRadius} onChange={(event) => setConfigForm((prev) => ({ ...prev, geoFenceRadius: event.target.value }))} /></div>
              </div>
              <button className="mini-action" disabled={loading} onClick={sendConfig}>Submit Config</button>
            </article>
            <article className="card-like">
              <h3>Command Preview</h3>
              <pre className="preview-box">{commandPreview || 'No command generated yet.'}</pre>
              <div className="status">{configStatus}</div>
              {configResult ? <pre className="replies conversation-box">{JSON.stringify(configResult, null, 2)}</pre> : null}
            </article>
          </section>
        )}

        {(activeSection === 'commands' || activeSection.startsWith('settings')) && (
          <section className="card-like gateway-panel">
            <h3>SMS Gateway & Testing</h3>
            <div className="field-grid two-col">
              <div><label>Gateway Base URL</label><input placeholder="https://gateway..." value={gatewayBaseUrl} onChange={(event) => setGatewayBaseUrl(event.target.value)} /></div>
              <div><label>Gateway Token</label><input placeholder="Authorization token" value={gatewayToken} onChange={(event) => setGatewayToken(event.target.value)} /></div>
            </div>
            <div className="field-grid two-col">
              <div><label>Test Phone Number</label><input value={phone} onChange={(event) => setPhone(event.target.value)} /></div>
              <div><label>Custom Message</label><input value={message} onChange={(event) => setMessage(event.target.value)} /></div>
            </div>
            <button className="mini-action" disabled={loading} onClick={sendMessage}>Send Test Message</button>
            <div className="status">{status}</div>
          </section>
        )}

        {activeSection === 'location' && <section className="card-like"><h3>Location</h3><p className="small-muted">Map/track controls can be integrated here.</p></section>}

        {activeSection === 'users' && (
          <section className="module-table card-like">
            <table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Contact</th><th>Location</th><th>Manager</th></tr></thead><tbody>{users.map((row) => <tr key={row[1]}>{row.map((col) => <td key={`${row[1]}-${col}`}>{col}</td>)}</tr>)}</tbody></table>
          </section>
        )}

        {activeSection === 'devices' && (
          <section className="module-table card-like">
            <table><thead><tr><th>Device</th><th>Phone</th><th>Owner</th><th>Role</th><th>Location</th></tr></thead><tbody>{devices.map((row) => <tr key={row[0]}>{row.map((col) => <td key={`${row[0]}-${col}`}>{col}</td>)}</tr>)}</tbody></table>
          </section>
        )}

        {activeSection === 'replies' && (
          <section className="module-table card-like replies-module">
            <button className="mini-action" disabled={loading} onClick={fetchReplies}>Refresh Replies</button>
            <table><thead><tr><th>Date</th><th>Phone Number</th><th>Text/Info</th><th>State</th></tr></thead><tbody>{repliesRows.map((row) => <tr key={`${row[0]}-${row[1]}`}>{row.map((col) => <td key={`${row[0]}-${col}`}>{col}</td>)}</tr>)}</tbody></table>
            <h4>Conversation</h4>
            <pre className="replies conversation-box">{formattedReplies}</pre>
          </section>
        )}

        {activeSection === 'dashboard' && (
          <section className="module-table card-like">
            <h3>Overview</h3>
            <table><thead><tr><th>Location</th><th>Details</th><th>Total Users</th><th>Total Devices</th></tr></thead><tbody>{locations.map((row) => <tr key={row[0]}>{row.map((col) => <td key={`${row[0]}-${col}`}>{col}</td>)}</tr>)}</tbody></table>
          </section>
        )}
      </div>
    </div>
  )
}
