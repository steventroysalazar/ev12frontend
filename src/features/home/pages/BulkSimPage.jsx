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
    <section className="card-like section-panel">
      <div className="section-head">
        <div>
          <h2 className="section-title">Bulk SIM Management</h2>
          <p className="status">Activate or deactivate SIMs for multiple devices at once.</p>
        </div>
        <div className="action-stack-row">
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

      <div className="table-shell">
        <table className="data-table devices-list-table">
          <thead>
            <tr>
              <th>
                <label className="inline-check-row">
                  <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
                  <span>Select all</span>
                </label>
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
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedDeviceIds.includes(deviceId)}
                      onChange={() => toggleDevice(deviceId)}
                      disabled={!deviceId || pending}
                    />
                  </td>
                  <td>{device.name || device.deviceName || '-'}</td>
                  <td>{device.phoneNumber || '-'}</td>
                  <td>{device.simIccid || '-'}</td>
                  <td>{pending ? 'Updating…' : simStatus}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
