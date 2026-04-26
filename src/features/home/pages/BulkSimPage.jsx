import AppIcon from '../../../components/icons/AppIcon'

export default function BulkSimPage({
  devices,
  selectedDeviceIds,
  setSelectedDeviceIds,
  onBulkSetSimActivation,
  simActionPendingByDevice,
  loading
}) {
  const selectedCount = selectedDeviceIds.length
  const selectableDeviceIds = devices.map((device) => String(device.id || device.deviceId || '')).filter(Boolean)
  const allSelected = selectableDeviceIds.length > 0 && selectableDeviceIds.every((id) => selectedDeviceIds.includes(id))
  const activatedCount = devices.filter((device) => device.simActivated || String(device.simStatus || '').toUpperCase() === 'ACTIVATED').length
  const deactivatedCount = Math.max(0, devices.length - activatedCount)

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedDeviceIds([])
      return
    }
    setSelectedDeviceIds(selectableDeviceIds)
  }

  const toggleDevice = (deviceId) => {
    setSelectedDeviceIds((prev) => (
      prev.includes(deviceId)
        ? prev.filter((id) => id !== deviceId)
        : [...prev, deviceId]
    ))
  }

  return (
    <section className="card-like section-panel bulk-sim-panel">
      <div className="section-head bulk-sim-head">
        <div className="bulk-sim-title-wrap">
          <h2 className="section-title">Bulk SIM Management</h2>
          <p className="status">Activate or deactivate SIMs for multiple devices at once.</p>
          <div className="bulk-sim-summary-row">
            <span className="bulk-sim-summary-chip">Total: {devices.length}</span>
            <span className="bulk-sim-summary-chip is-active">Active: {activatedCount}</span>
            <span className="bulk-sim-summary-chip is-idle">Inactive: {deactivatedCount}</span>
            <span className="bulk-sim-summary-chip is-selected">Selected: {selectedCount}</span>
          </div>
        </div>
        <div className="action-stack-row bulk-sim-actions">
          <button
            className="mini-action"
            type="button"
            disabled={!selectedCount || loading}
            onClick={() => onBulkSetSimActivation(true)}
          >
            <AppIcon name="plus" className="btn-icon" />Activate Selected ({selectedCount})
          </button>
          <button
            className="mini-action"
            type="button"
            disabled={!selectedCount || loading}
            onClick={() => onBulkSetSimActivation(false)}
          >
            <AppIcon name="command" className="btn-icon" />Deactivate Selected ({selectedCount})
          </button>
        </div>
      </div>

      <div className="table-shell bulk-sim-table-shell">
        <table className="data-table devices-list-table bulk-sim-table">
          <thead>
            <tr>
              <th className="bulk-select-col">
                <div className="bulk-select-check-wrap">
                  <input
                    className="bulk-sim-check"
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all devices"
                  />
                </div>
              </th>
              <th>Device</th>
              <th>Phone</th>
              <th>SIM ICCID</th>
              <th>SIM Status</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => {
              const deviceId = String(device.id || device.deviceId || '')
              const pending = Boolean(simActionPendingByDevice?.[deviceId])
              const simStatus = String(device.simStatus || '').trim() || (device.simActivated ? 'ACTIVATED' : 'DEACTIVATED')
              return (
                <tr key={deviceId || device.phoneNumber || device.name}>
                  <td className="bulk-select-col">
                    <input
                      className="bulk-sim-check"
                      type="checkbox"
                      checked={selectedDeviceIds.includes(deviceId)}
                      onChange={() => toggleDevice(deviceId)}
                      disabled={!deviceId || pending}
                      aria-label={`Select ${device.name || device.deviceName || 'device'}`}
                    />
                  </td>
                  <td>{device.name || device.deviceName || '-'}</td>
                  <td>{device.phoneNumber || '-'}</td>
                  <td>{device.simIccid || '-'}</td>
                  <td>
                    <span className={`bulk-sim-status-pill ${pending ? 'is-pending' : (simStatus.toUpperCase() === 'ACTIVATED' ? 'is-active' : 'is-idle')}`}>
                      {pending ? 'Updating…' : simStatus}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
