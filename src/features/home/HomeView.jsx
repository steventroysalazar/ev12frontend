import Sidebar from '../../components/sidebar/Sidebar'

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
  return (
    <div className="home-layout">
      <Sidebar />

      <div className="home-content">
        <section id="gateway" className="card">
          <h2>Gateway Overrides</h2>
          <div className="field-grid two-col">
            <div>
              <label>Gateway Base URL</label>
              <input
                placeholder="https://example.com (optional)"
                value={gatewayBaseUrl}
                onChange={(event) => setGatewayBaseUrl(event.target.value)}
              />
            </div>
            <div>
              <label>Gateway Token</label>
              <input
                placeholder="Authorization token (optional)"
                value={gatewayToken}
                onChange={(event) => setGatewayToken(event.target.value)}
              />
            </div>
          </div>
        </section>

        <section id="builder" className="card command-builder">
          <div className="section-heading">
            <h2>EV12 Command Builder</h2>
            <p className="subtitle">Structured device configuration with live command preview.</p>
          </div>

          <div className="builder-layout">
            <div className="builder-column">
              <article className="panel">
                <h3>Device & Contact</h3>
                <div className="field-grid">
                  <div><label>Device ID</label><input value={configForm.deviceId} onChange={(event) => setConfigForm((prev) => ({ ...prev, deviceId: event.target.value }))} /></div>
                  <div><label>IMEI</label><input value={configForm.imei} onChange={(event) => setConfigForm((prev) => ({ ...prev, imei: event.target.value }))} /></div>
                  <div><label>Contact Number</label><input value={configForm.contactNumber} onChange={(event) => setConfigForm((prev) => ({ ...prev, contactNumber: event.target.value }))} /></div>
                  <div><label>Contact Name</label><input value={configForm.contactName} onChange={(event) => setConfigForm((prev) => ({ ...prev, contactName: event.target.value }))} /></div>
                  <div><label>SMS Password</label><input value={configForm.smsPassword} onChange={(event) => setConfigForm((prev) => ({ ...prev, smsPassword: event.target.value }))} /></div>
                  <div><label>Prefix Name</label><input value={configForm.prefixName} onChange={(event) => setConfigForm((prev) => ({ ...prev, prefixName: event.target.value }))} /></div>
                </div>
              </article>

              <article className="panel">
                <h3>Safety & Tracking</h3>
                <div className="field-grid">
                  <div><label>Over Speed Limit</label><input value={configForm.overSpeedLimit} onChange={(event) => setConfigForm((prev) => ({ ...prev, overSpeedLimit: event.target.value }))} /></div>
                  <div><label>Geo Fence Radius</label><input value={configForm.geoFenceRadius} onChange={(event) => setConfigForm((prev) => ({ ...prev, geoFenceRadius: event.target.value }))} /></div>
                  <div><label>Locate Interval</label><input value={configForm.continuousLocateInterval} onChange={(event) => setConfigForm((prev) => ({ ...prev, continuousLocateInterval: event.target.value }))} /></div>
                  <div><label>Locate Duration</label><input value={configForm.continuousLocateDuration} onChange={(event) => setConfigForm((prev) => ({ ...prev, continuousLocateDuration: event.target.value }))} /></div>
                  <div><label>Time Zone</label><input value={configForm.timeZone} onChange={(event) => setConfigForm((prev) => ({ ...prev, timeZone: event.target.value }))} /></div>
                  <div><label>Speaker Volume</label><input value={configForm.speakerVolume} onChange={(event) => setConfigForm((prev) => ({ ...prev, speakerVolume: event.target.value }))} /></div>
                </div>
              </article>
            </div>

            <div className="builder-column">
              <article className="panel">
                <h3>Feature Toggles</h3>
                <div className="toggle-grid">
                  <label className="toggle-item"><input type="checkbox" checked={configForm.requestLocation} onChange={(event) => setConfigForm((prev) => ({ ...prev, requestLocation: event.target.checked }))} /> Request location (loc)</label>
                  <label className="toggle-item"><input type="checkbox" checked={configForm.requestGpsLocation} onChange={(event) => setConfigForm((prev) => ({ ...prev, requestGpsLocation: event.target.checked }))} /> Request GPS (loc,gps)</label>
                  <label className="toggle-item"><input type="checkbox" checked={configForm.smsWhitelistEnabled} onChange={(event) => setConfigForm((prev) => ({ ...prev, smsWhitelistEnabled: event.target.checked }))} /> SMS whitelist</label>
                  <label className="toggle-item"><input type="checkbox" checked={configForm.fallDownCall} onChange={(event) => setConfigForm((prev) => ({ ...prev, fallDownCall: event.target.checked }))} /> Fall detection call</label>
                  <label className="toggle-item"><input type="checkbox" checked={configForm.motionCall} onChange={(event) => setConfigForm((prev) => ({ ...prev, motionCall: event.target.checked }))} /> Motion alarm call</label>
                  <label className="toggle-item"><input type="checkbox" checked={configForm.checkStatus} onChange={(event) => setConfigForm((prev) => ({ ...prev, checkStatus: event.target.checked }))} /> Include status</label>
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

        <section id="messaging" className="card">
          <h2>Send Single Message</h2>
          <input placeholder="Phone Number" value={phone} onChange={(event) => setPhone(event.target.value)} />
          <textarea rows={4} placeholder="Type your message" value={message} onChange={(event) => setMessage(event.target.value)} />
          <button disabled={loading} onClick={sendMessage}>Send</button>
        </section>

        <section id="replies" className="card">
          <h2>Fetch Replies</h2>
          <button disabled={loading} onClick={fetchReplies}>Manually Fetch Replies</button>
          <div className="status">{status}</div>
          <pre className="replies">{formattedReplies}</pre>
        </section>
      </div>
    </div>
  )
}
