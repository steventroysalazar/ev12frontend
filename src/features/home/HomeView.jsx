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
                <button disabled={loading} onClick={fetchReplies}>Request Location</button>
              </aside>
            </section>
          </>
        )}

        {activeSection === 'settings-basic' && (
          <section className="card-like section-panel">
            <h2 className="section-title">Settings &gt; Basic Configuration</h2>
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

            <h3 className="block-title">Contact Information</h3>
            <div className="contact-table">
              <div className="contact-head"><span>Contact</span><span>Name</span><span>Contact Number</span><span>SMS</span><span>Call</span><span /></div>
              <div className="contact-row"><span className="chip">Contact 1</span><span>{configForm.contactName || 'John Doe'}</span><span>{configForm.contactNumber || '+639198765432'}</span><span>Off</span><span>Off</span><span>✎ 🗑</span></div>
              <div className="contact-row"><span className="chip">Contact 2</span><span>—</span><span>—</span><span>Off</span><span>Off</span><span>✎ 🗑</span></div>
              <button className="mini-action add-contact">+ Add Contact</button>
            </div>

            <div className="field-grid two-col footer-config">
              <div>
                <label>SMS Password</label>
                <input value={configForm.smsPassword} onChange={(event) => setConfigForm((prev) => ({ ...prev, smsPassword: event.target.value }))} />
              </div>
              <div>
                <label>SMS White List</label>
                <select value={configForm.smsWhitelistEnabled ? '1' : '0'} onChange={(event) => setConfigForm((prev) => ({ ...prev, smsWhitelistEnabled: event.target.value === '1' }))}><option value="0">Off</option><option value="1">On</option></select>
              </div>
            </div>
          </section>
        )}

        {activeSection === 'settings-alarm' && (
          <section className="card-like section-panel">
            <h2 className="section-title">Settings &gt; Alarm Settings</h2>

            <div className="alarm-card">
              <h3>SOS</h3>
              <div className="alarm-row">
                <label>Mode</label>
                <input
                  value={configForm.sosMode}
                  onChange={(event) => setConfigForm((prev) => ({ ...prev, sosMode: event.target.value }))}
                />
                <label>Action Time</label>
                <input
                  value={configForm.sosActionTime}
                  onChange={(event) => setConfigForm((prev) => ({ ...prev, sosActionTime: event.target.value }))}
                />
              </div>
            </div>

            <div className="alarm-card">
              <h3>Fall Detection</h3>
              <div className="alarm-row">
                <label>Enable</label>
                <select
                  value={configForm.fallDownEnabled}
                  onChange={(event) => setConfigForm((prev) => ({ ...prev, fallDownEnabled: event.target.value }))}
                >
                  <option value="0">Off</option>
                  <option value="1">On</option>
                </select>
                <label>Sensitivity</label>
                <input
                  value={configForm.fallDownSensitivity}
                  onChange={(event) => setConfigForm((prev) => ({ ...prev, fallDownSensitivity: event.target.value }))}
                />
              </div>
            </div>

            <div className="alarm-card">
              <h3>Motion / No Motion</h3>
              <div className="alarm-row">
                <label>Enable</label>
                <select
                  value={configForm.motionEnabled}
                  onChange={(event) => setConfigForm((prev) => ({ ...prev, motionEnabled: event.target.value }))}
                >
                  <option value="0">Off</option>
                  <option value="1">On</option>
                </select>
                <label>Duration</label>
                <input
                  value={configForm.motionDurationTime}
                  onChange={(event) => setConfigForm((prev) => ({ ...prev, motionDurationTime: event.target.value }))}
                />
              </div>
            </div>

            <div className="alarm-card">
              <h3>Over-speed</h3>
              <div className="alarm-row">
                <label>Enable</label>
                <select
                  value={configForm.overSpeedEnabled}
                  onChange={(event) => setConfigForm((prev) => ({ ...prev, overSpeedEnabled: event.target.value }))}
                >
                  <option value="0">Off</option>
                  <option value="1">On</option>
                </select>
                <label>Speed Limit</label>
                <input
                  value={configForm.overSpeedLimit}
                  onChange={(event) => setConfigForm((prev) => ({ ...prev, overSpeedLimit: event.target.value }))}
                />
              </div>
            </div>

            <div className="alarm-card">
              <h3>Geo-fence</h3>
              <div className="alarm-row">
                <label>Enable</label>
                <select
                  value={configForm.geoFenceEnabled}
                  onChange={(event) => setConfigForm((prev) => ({ ...prev, geoFenceEnabled: event.target.value }))}
                >
                  <option value="0">Off</option>
                  <option value="1">On</option>
                </select>
                <label>Radius</label>
                <input
                  value={configForm.geoFenceRadius}
                  onChange={(event) => setConfigForm((prev) => ({ ...prev, geoFenceRadius: event.target.value }))}
                />
              </div>
            </div>
          </section>
        )}

        {activeSection === 'location' && (
          <section className="section-panel">
            <h2 className="page-title">Location</h2>
            <article className="card-like map-panel">
              <div className="map-placeholder">
                <span className="map-chip">Lat: -33.8698439 Lon: 151.2082848</span>
              </div>
              <button className="mini-action request-btn" disabled={loading} onClick={sendMessage}>Request Location</button>
            </article>
            <div className="location-grid">
              <article className="card-like"><h3>Continuous Tracking</h3><div className="field-grid"><label>Enable</label><select><option>Off</option><option>On</option></select><label>Interval</label><input placeholder="Seconds" /><label>Duration</label><input placeholder="Minutes" /></div></article>
              <article className="card-like"><h3>Geo-fence Settings</h3><div className="field-grid"><label>Enable</label><select><option>Off</option><option>On</option></select><label>Radius</label><input /><label>Action</label><select><option>Select</option><option>Alert</option></select></div></article>
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
                <button className="mini-action" disabled={loading} onClick={sendConfig}>Submit</button>
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

        <section className="card-like replies-section">
          <h3>Replies Conversation</h3>
          <button className="mini-action" disabled={loading} onClick={fetchReplies}>Refresh Replies</button>
          <pre className="replies conversation-box">{formattedReplies}</pre>
        </section>
      </div>
    </div>
  )
}
