import AppIcon from '../../../components/icons/AppIcon'

export default function DevicesPage({
  loadUsers,
  loadLocations,
  setShowDeviceModal,
  deviceSearch,
  setDeviceSearch,
  deviceAlarmFilter,
  setDeviceAlarmFilter,
  pagedDevices,
  resolveDeviceMeta,
  getAlarmMeta,
  resolveLiveAlarmCode,
  getAlarmCancelledAt,
  handleCancelAlarm,
  formatTimestamp,
  openLocationDetailPage,
  openEditDeviceModal,
  openDeviceSettings,
  devicesPage,
  setDevicesPage
}) {
  return (
    <section className="card-like section-panel">
      <div className="section-head">
        <h2 className="section-title">Devices</h2>
        <button className="mini-action" onClick={async () => { await Promise.all([loadUsers(), loadLocations()]); setShowDeviceModal(true) }}><AppIcon name="plus" className="btn-icon" />Add Device</button>
      </div>
      <div className="table-controls">
        <input placeholder="Search device, owner, location, phone..." value={deviceSearch} onChange={(event) => setDeviceSearch(event.target.value)} />
        <select value={deviceAlarmFilter} onChange={(event) => setDeviceAlarmFilter(event.target.value)}>
          <option value="all">All alarms</option>
          <option value="critical">SOS only</option>
          <option value="warning">Fall alert only</option>
          <option value="active">Other active alarms</option>
          <option value="idle">No active alarm</option>
        </select>
      </div>
      <div className="table-shell">
        <table className="data-table">
          <thead><tr><th>Device</th><th>Phone</th><th>Version</th><th>Webhook Device ID</th><th>Alarm</th><th>Last Power ON</th><th>Last Power OFF</th><th>Last Disconnected</th><th>Owner</th><th>Role</th><th>Location</th><th>Edit</th><th>Settings</th></tr></thead>
          <tbody>
            {pagedDevices.rows.map((d) => {
              const deviceMeta = resolveDeviceMeta(d)
              const alarmMeta = getAlarmMeta(resolveLiveAlarmCode(d))
              const cancelledAt = getAlarmCancelledAt(d)
              const deviceLocationId = d.locationId || d.location_id || d.location?.id || ''
              return (
                <tr key={d.id || d.phoneNumber || d.name}>
                  <td>{d.name || d.deviceName || '-'}</td>
                  <td>{d.phoneNumber || '-'}</td>
                  <td>{d.eviewVersion || d.version || '-'}</td>
                  <td>{d.externalDeviceId || d.external_device_id || d.deviceId || '-'}</td>
                  <td>
                    <div className="alarm-status-inline">
                      <span className={`alarm-pill alarm-pill-${alarmMeta.tone}`}>{alarmMeta.label}</span>
                      <button
                        className="table-link table-link-compact action-chip action-chip-danger device-cancel-inline"
                        type="button"
                        onClick={() => handleCancelAlarm(d)}
                        disabled={!resolveLiveAlarmCode(d)}
                        title={!resolveLiveAlarmCode(d) ? 'No active alarm to cancel' : 'Cancel active alarm'}
                      >
                        Cancel Alarm
                      </button>
                      {cancelledAt ? <small className="alarm-cancel-meta">Cancelled: {new Date(cancelledAt).toLocaleString()}</small> : null}
                    </div>
                  </td>
                  <td>{formatTimestamp(d.lastPowerOnAt || d.last_power_on_at)}</td>
                  <td>{formatTimestamp(d.lastPowerOffAt || d.last_power_off_at)}</td>
                  <td>{formatTimestamp(d.lastDisconnectedAt || d.last_disconnected_at)}</td>
                  <td>{deviceMeta.ownerName}</td>
                  <td>{deviceMeta.ownerRole}</td>
                  <td>{deviceLocationId ? <button className="table-link table-link-compact" type="button" onClick={() => openLocationDetailPage({ id: deviceLocationId })}>{deviceMeta.ownerLocation}</button> : deviceMeta.ownerLocation}</td>
                  <td><button className="table-link table-link-compact action-chip action-chip-neutral" type="button" onClick={() => openEditDeviceModal(d)}>Edit</button></td>
                  <td><button className="table-link table-link-compact action-chip action-chip-primary" type="button" onClick={() => openDeviceSettings(d)}>Open Settings</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="table-pagination">
        <button type="button" className="table-link action-chip action-chip-neutral" disabled={devicesPage <= 1} onClick={() => setDevicesPage((prev) => Math.max(prev - 1, 1))}>Prev</button>
        <span>Page {devicesPage} of {pagedDevices.totalPages}</span>
        <button type="button" className="table-link action-chip action-chip-neutral" disabled={devicesPage >= pagedDevices.totalPages} onClick={() => setDevicesPage((prev) => Math.min(prev + 1, pagedDevices.totalPages))}>Next</button>
      </div>
    </section>
  )
}
