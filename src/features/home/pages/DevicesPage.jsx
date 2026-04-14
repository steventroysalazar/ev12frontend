import AppIcon from '../../../components/icons/AppIcon'
import Autocomplete from '@mui/material/Autocomplete'
import TextField from '@mui/material/TextField'

export default function DevicesPage({
  devices,
  loadUsers,
  loadLocations,
  setShowDeviceModal,
  deviceFilters,
  setDeviceFilters,
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
  openDeviceSettings,
  devicesPage,
  setDevicesPage
}) {
  const filterOptions = devices.reduce((acc, entry) => {
    const owner = resolveDeviceMeta(entry)
    const deviceName = entry.name || entry.deviceName || ''
    const phone = entry.phoneNumber || ''
    const location = owner.ownerLocation || ''
    const ownerName = owner.ownerName || ''

    if (deviceName) acc.device.add(deviceName)
    if (phone) acc.phone.add(phone)
    if (location) acc.location.add(location)
    if (ownerName) acc.owner.add(ownerName)
    return acc
  }, { device: new Set(), owner: new Set(), location: new Set(), phone: new Set() })

  const updateFilter = (key, value) => {
    setDeviceFilters((prev) => ({ ...prev, [key]: value || '' }))
  }

  return (
    <section className="card-like section-panel">
      <div className="section-head">
        <h2 className="section-title">Devices</h2>
        <button className="mini-action" onClick={async () => { await Promise.all([loadUsers(), loadLocations()]); setShowDeviceModal(true) }}><AppIcon name="plus" className="btn-icon" />Add Device</button>
      </div>
      <div className="table-controls">
        <div className="device-filter-grid">
          <Autocomplete
            freeSolo
            options={[...filterOptions.device].sort((a, b) => a.localeCompare(b))}
            value={deviceFilters.device}
            onInputChange={(_, value) => updateFilter('device', value)}
            renderInput={(params) => <TextField {...params} placeholder="Search by device..." size="small" />}
          />
          <Autocomplete
            freeSolo
            options={[...filterOptions.owner].sort((a, b) => a.localeCompare(b))}
            value={deviceFilters.owner}
            onInputChange={(_, value) => updateFilter('owner', value)}
            renderInput={(params) => <TextField {...params} placeholder="Search by owner..." size="small" />}
          />
          <Autocomplete
            freeSolo
            options={[...filterOptions.location].sort((a, b) => a.localeCompare(b))}
            value={deviceFilters.location}
            onInputChange={(_, value) => updateFilter('location', value)}
            renderInput={(params) => <TextField {...params} placeholder="Search by location..." size="small" />}
          />
          <Autocomplete
            freeSolo
            options={[...filterOptions.phone].sort((a, b) => a.localeCompare(b))}
            value={deviceFilters.phone}
            onInputChange={(_, value) => updateFilter('phone', value)}
            renderInput={(params) => <TextField {...params} placeholder="Search by phone..." size="small" />}
          />
        </div>
        <select value={deviceAlarmFilter} onChange={(event) => setDeviceAlarmFilter(event.target.value)}>
          <option value="all">All alarms</option>
          <option value="critical">SOS only</option>
          <option value="warning">Fall alert only</option>
          <option value="active">Other active alarms</option>
          <option value="idle">No active alarm</option>
        </select>
      </div>
      <div className="table-shell">
        <table className="data-table devices-list-table">
          <thead><tr><th>Settings</th><th>Device</th><th>Phone</th><th>Version</th><th>Webhook Device ID</th><th>Alarm</th><th>Last Power ON</th><th>Last Power OFF</th><th>Last Disconnected</th><th>Owner</th><th>Role</th><th>Location</th></tr></thead>
          <tbody>
            {pagedDevices.rows.map((d) => {
              const deviceMeta = resolveDeviceMeta(d)
              const alarmMeta = getAlarmMeta(resolveLiveAlarmCode(d))
              const cancelledAt = getAlarmCancelledAt(d)
              const deviceLocationId = d.locationId || d.location_id || d.location?.id || ''
              return (
                <tr key={d.id || d.phoneNumber || d.name}>
                  <td><button className="table-link table-link-compact action-chip action-chip-primary" type="button" onClick={() => openDeviceSettings(d)}>Open Settings</button></td>
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
