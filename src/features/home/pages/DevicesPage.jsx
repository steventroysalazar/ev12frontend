import AppIcon from '../../../components/icons/AppIcon'
import { Fragment, useState } from 'react'

const DEFAULT_EVIEW_DEVICE_VERSIONS = ['EV-04', 'EV-07', 'EV-08', 'EV-10', 'EV-12']

function SuggestionInput({ id, placeholder, value, options, onChange }) {
  return (
    <>
      <input
        list={id}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <datalist id={id}>
        {options.map((entry) => (
          <option key={`${id}-${entry}`} value={entry} />
        ))}
      </datalist>
    </>
  )
}

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
  handleCancelAlarm,
  openDeviceSettings,
  onSetSimActivation,
  simActionPendingByDevice,
  devicesPage,
  setDevicesPage
}) {
  const [expandedRowId, setExpandedRowId] = useState(null)

  const filterOptions = devices.reduce((acc, entry) => {
    const owner = resolveDeviceMeta(entry)
    const deviceName = entry.name || entry.deviceName || ''
    const phone = entry.phoneNumber || ''
    const location = owner.ownerLocation || ''
    const ownerName = owner.ownerName || ''
    const version = entry.eviewVersion || entry.version || ''

    if (deviceName) acc.device.add(deviceName)
    if (phone) acc.phone.add(phone)
    if (location) acc.location.add(location)
    if (ownerName) acc.owner.add(ownerName)
    if (version) acc.version.add(version)
    return acc
  }, { device: new Set(), owner: new Set(), location: new Set(), phone: new Set(), version: new Set() })

  const deviceVersionFilterOptions = [...new Set([
    ...DEFAULT_EVIEW_DEVICE_VERSIONS,
    ...[...filterOptions.version]
  ])].sort((a, b) => a.localeCompare(b))

  const updateFilter = (key, value) => {
    setDeviceFilters((prev) => ({ ...prev, [key]: value || '' }))
  }

  return (
    <section className="device-list-workspace">
      <header className="device-list-page-head">
        <div>
          <h2 className="page-title device-list-page-title">Devices</h2>
          <p className="device-list-page-subtitle">Device workspace loaded.</p>
        </div>
      </header>

      <div className="card-like section-panel device-list-card">
        <div className="section-head">
          <h2 className="section-title">Devices</h2>
          <button className="mini-action device-list-add-btn" onClick={async () => { await Promise.all([loadUsers(), loadLocations()]); setShowDeviceModal(true) }}><AppIcon name="plus" className="btn-icon" />Add Device</button>
        </div>
        <div className="table-controls device-table-controls">
          <div className="device-filter-grid">
            <SuggestionInput
              id="device-filter-device"
              placeholder="Search by device..."
              value={deviceFilters.device}
              options={[...filterOptions.device].sort((a, b) => a.localeCompare(b))}
              onChange={(value) => updateFilter('device', value)}
            />
            <SuggestionInput
              id="device-filter-owner"
              placeholder="Search by owner..."
              value={deviceFilters.owner}
              options={[...filterOptions.owner].sort((a, b) => a.localeCompare(b))}
              onChange={(value) => updateFilter('owner', value)}
            />
            <SuggestionInput
              id="device-filter-location"
              placeholder="Search by location..."
              value={deviceFilters.location}
              options={[...filterOptions.location].sort((a, b) => a.localeCompare(b))}
              onChange={(value) => updateFilter('location', value)}
            />
            <SuggestionInput
              id="device-filter-phone"
              placeholder="Search by phone..."
              value={deviceFilters.phone}
              options={[...filterOptions.phone].sort((a, b) => a.localeCompare(b))}
              onChange={(value) => updateFilter('phone', value)}
            />
            <select value={deviceFilters.version} onChange={(event) => updateFilter('version', event.target.value)}>
              <option value="">All versions</option>
              {deviceVersionFilterOptions.map((version) => (
                <option key={`device-version-filter-${version}`} value={version}>{version}</option>
              ))}
            </select>
          </div>
          <select value={deviceAlarmFilter} onChange={(event) => setDeviceAlarmFilter(event.target.value)}>
            <option value="all">All alarms</option>
            <option value="critical">SOS only</option>
            <option value="warning">Fall alert only</option>
            <option value="active">Other active alarms</option>
            <option value="idle">No active alarm</option>
          </select>
        </div>
        <div className="table-shell table-shell-tall">
          <table className="data-table devices-list-table expandable-rows-table">
            <thead><tr><th>Settings</th><th>SIM</th><th>Device</th><th>Phone</th><th>Version</th><th>Webhook Device ID</th><th>Alarm</th><th>Owner</th><th>Location</th></tr></thead>
            <tbody>
              {pagedDevices.rows.map((d) => {
                const alarmMeta = getAlarmMeta(resolveLiveAlarmCode(d))
                const deviceMeta = resolveDeviceMeta(d)
                const deviceId = d.id || d.deviceId
                const simActivated = d.simActivated === true
                const simActionPending = Boolean(simActionPendingByDevice?.[deviceId])
                const rowKey = String(d.id || d.deviceId || d.phoneNumber || d.name)
                const isExpanded = expandedRowId === rowKey
                const toggleExpanded = () => setExpandedRowId((prev) => (prev === rowKey ? null : rowKey))
                return (
                  <Fragment key={rowKey}>
                    <tr className={`expandable-row ${isExpanded ? 'is-expanded' : ''}`} onClick={toggleExpanded}>
                      <td>
                        <div className="device-settings-cell">
                          <button
                            type="button"
                            className={`row-chevron ${isExpanded ? 'is-expanded' : ''}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              toggleExpanded()
                            }}
                            aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
                          >
                            ▸
                          </button>
                          <button
                            className="table-link table-link-compact action-chip action-chip-primary device-manage-button"
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              openDeviceSettings(d)
                            }}
                          >
                            Manage
                          </button>
                        </div>
                      </td>
                      <td>
                        <button
                          className={`table-link table-link-compact action-chip ${simActivated ? 'action-chip-danger' : 'action-chip-neutral'}`}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            onSetSimActivation?.(d, !simActivated)
                          }}
                          disabled={simActionPending}
                        >
                          {simActionPending ? 'Working…' : simActivated ? 'Deactivate SIM' : 'Activate SIM'}
                        </button>
                      </td>
                      <td>{d.name || d.deviceName || '-'}</td>
                      <td>{d.phoneNumber || '-'}</td>
                      <td>{d.eviewVersion || d.version || '-'}</td>
                      <td>{d.externalDeviceId || d.external_device_id || d.deviceId || '-'}</td>
                      <td className="device-alarm-cell">
                        <span className={`alarm-pill alarm-pill-${alarmMeta.tone}`}>{alarmMeta.label}</span>
                        <button
                          className="table-link table-link-compact action-chip action-chip-danger device-alarm-cancel-btn"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            handleCancelAlarm?.(d)
                          }}
                          disabled={!resolveLiveAlarmCode(d)}
                        >
                          Cancel Alarm
                        </button>
                      </td>
                      <td>{deviceMeta.ownerName || '-'}</td>
                      <td>{deviceMeta.ownerLocation || '-'}</td>
                    </tr>
                    {isExpanded ? (
                      <tr className="expandable-row-detail">
                        <td colSpan={9}>
                          <div className="expand-detail-panel">
                            <div><span>Device ID</span><strong>{d.id || d.deviceId || '-'}</strong></div>
                            <div><span>Phone</span><strong>{d.phoneNumber || '-'}</strong></div>
                            <div><span>Version</span><strong>{d.eviewVersion || d.version || '-'}</strong></div>
                            <div><span>Webhook ID</span><strong>{d.externalDeviceId || d.external_device_id || '-'}</strong></div>
                            <div><span>Owner</span><strong>{deviceMeta.ownerName || '-'}</strong></div>
                            <div><span>Location</span><strong>{deviceMeta.ownerLocation || '-'}</strong></div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="table-pagination device-table-pagination">
          <button type="button" className="table-link action-chip action-chip-neutral" disabled={devicesPage <= 1} onClick={() => setDevicesPage((prev) => Math.max(prev - 1, 1))}>Prev</button>
          <span>Page {devicesPage} of {pagedDevices.totalPages}</span>
          <button type="button" className="table-link action-chip action-chip-neutral" disabled={devicesPage >= pagedDevices.totalPages} onClick={() => setDevicesPage((prev) => Math.min(prev + 1, pagedDevices.totalPages))}>Next</button>
        </div>
      </div>
    </section>
  )
}
