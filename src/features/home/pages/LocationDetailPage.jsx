import { Fragment, useState } from 'react'

export default function LocationDetailPage({
  selectedLocation,
  devices,
  users,
  locationForm,
  setLocationForm,
  onSaveLocation,
  resolveDeviceMeta,
  openDeviceSettings,
  locationUserSearch,
  setLocationUserSearch,
  locationUserPage,
  setLocationUserPage,
  locationDeviceSearch,
  setLocationDeviceSearch,
  locationDevicePage,
  setLocationDevicePage,
  onBack
}) {
  const [expandedUserRowId, setExpandedUserRowId] = useState(null)
  const [expandedDeviceRowId, setExpandedDeviceRowId] = useState(null)
  const pageSize = 20
  const locationId = String(selectedLocation?.id || '')
  const locationUsers = users.filter((entry) => String(entry.locationId || entry.location_id || entry.location?.id || '') === locationId)
  const locationDevices = devices.filter((entry) => String(entry.locationId || entry.location_id || entry.location?.id || '') === locationId)

  const filteredUsers = locationUsers.filter((entry) => {
    const text = `${entry.firstName || ''} ${entry.lastName || ''} ${entry.email || ''} ${entry.contactNumber || ''}`.toLowerCase()
    return !locationUserSearch.trim() || text.includes(locationUserSearch.trim().toLowerCase())
  })
  const userTotalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize))
  const userCurrentPage = Math.min(Math.max(locationUserPage, 1), userTotalPages)
  const userStart = (userCurrentPage - 1) * pageSize
  const pagedUsers = filteredUsers.slice(userStart, userStart + pageSize)

  const filteredDevices = locationDevices.filter((entry) => {
    const text = `${entry.name || entry.deviceName || ''} ${entry.phoneNumber || ''} ${entry.eviewVersion || entry.version || ''}`.toLowerCase()
    return !locationDeviceSearch.trim() || text.includes(locationDeviceSearch.trim().toLowerCase())
  })
  const deviceTotalPages = Math.max(1, Math.ceil(filteredDevices.length / pageSize))
  const deviceCurrentPage = Math.min(Math.max(locationDevicePage, 1), deviceTotalPages)
  const deviceStart = (deviceCurrentPage - 1) * pageSize
  const pagedDevices = filteredDevices.slice(deviceStart, deviceStart + pageSize)

  return (
    <section className="card-like section-panel">
      <div className="section-head">
        <h2 className="section-title">Location Page</h2>
        <button className="table-link action-chip action-chip-neutral" type="button" onClick={onBack}>← Back to Locations</button>
      </div>
      {!selectedLocation ? (
        <p className="status">Location not found. Select a location from the Locations page.</p>
      ) : (
        <>
          <article className="card-like detail-overview-card">
            <p className="status-success">Single-page view for {selectedLocation.name || 'location'}.</p>
            <div className="field-grid two-col">
              <div><label>Location Name</label><input value={selectedLocation.name || '-'} readOnly /></div>
              <div><label>Details</label><input value={selectedLocation.details || '-'} readOnly /></div>
              <div><label>User Count</label><input value={String(selectedLocation.userCount || selectedLocation.users?.length || locationUsers.length || 0)} readOnly /></div>
              <div><label>Device Count</label><input value={String(selectedLocation.deviceCount || selectedLocation.devices?.length || locationDevices.length || 0)} readOnly /></div>
            </div>
          </article>

          <article className="card-like detail-edit-card">
            <div className="section-head">
              <h3 className="block-title">Edit Location Information</h3>
              <button className="mini-action" type="button" onClick={onSaveLocation}>Save Location</button>
            </div>
            <div className="field-grid two-col">
              <input placeholder="Location name" value={locationForm.name} onChange={(event) => setLocationForm((prev) => ({ ...prev, name: event.target.value }))} />
              <input placeholder="Details" value={locationForm.details} onChange={(event) => setLocationForm((prev) => ({ ...prev, details: event.target.value }))} />
            </div>
            <div className="section-head">
              <h3 className="block-title">Alarm Receiver Configuration</h3>
            </div>
            <div className="field-grid two-col">
              <input
                placeholder="Account number"
                value={locationForm.alarmReceiverAccountNumber || ''}
                onChange={(event) => setLocationForm((prev) => ({ ...prev, alarmReceiverAccountNumber: event.target.value }))}
              />
              <input
                placeholder="Users (comma-separated)"
                value={locationForm.alarmReceiverUsers || ''}
                onChange={(event) => setLocationForm((prev) => ({ ...prev, alarmReceiverUsers: event.target.value }))}
              />
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={Boolean(locationForm.alarmReceiverEnabled)}
                  onChange={(event) => setLocationForm((prev) => ({ ...prev, alarmReceiverEnabled: event.target.checked }))}
                />
                <span>Enable location alarm receiver</span>
              </label>
              <label className="checkbox-field">
                <input
                  type="checkbox"
                  checked={Boolean(locationForm.toggleCompanyAlarmReceiver)}
                  onChange={(event) => setLocationForm((prev) => ({ ...prev, toggleCompanyAlarmReceiver: event.target.checked }))}
                />
                <span>Toggle company alarm receiver after save</span>
              </label>
            </div>
          </article>

          <div className="section-head">
            <h3 className="block-title">Users in this Location</h3>
            <input placeholder="Search users..." value={locationUserSearch} onChange={(event) => { setLocationUserSearch(event.target.value); setLocationUserPage(1) }} />
          </div>
          <div className="section-head">
            <h3 className="block-title">Devices in this Location</h3>
            <input placeholder="Search devices..." value={locationDeviceSearch} onChange={(event) => { setLocationDeviceSearch(event.target.value); setLocationDevicePage(1) }} />
          </div>
          <div className="table-shell">
            <table className="data-table expandable-rows-table">
              <thead><tr><th>Name</th><th>Email</th><th>Contact</th></tr></thead>
              <tbody>
                {pagedUsers.map((entry) => {
                  const rowKey = `location-user-${entry.id || entry.email}`
                  const isExpanded = expandedUserRowId === rowKey
                  const toggleExpanded = () => setExpandedUserRowId((prev) => (prev === rowKey ? null : rowKey))
                  return (
                    <Fragment key={rowKey}>
                      <tr className={`expandable-row ${isExpanded ? 'is-expanded' : ''}`} onClick={toggleExpanded}>
                        <td>{`${entry.firstName || ''} ${entry.lastName || ''}`.trim() || entry.name || '-'}</td>
                        <td>{entry.email || '-'}</td>
                        <td>{entry.contactNumber || '-'}</td>
                      </tr>
                      {isExpanded ? (
                        <tr className="expandable-row-detail">
                          <td colSpan={3}>
                            <div className="expand-detail-panel">
                              <div><span>Name</span><strong>{`${entry.firstName || ''} ${entry.lastName || ''}`.trim() || entry.name || '-'}</strong></div>
                              <div><span>Email</span><strong>{entry.email || '-'}</strong></div>
                              <div><span>Contact</span><strong>{entry.contactNumber || '-'}</strong></div>
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
          <div className="table-pagination">
            <button type="button" className="table-link action-chip action-chip-neutral" disabled={userCurrentPage <= 1} onClick={() => setLocationUserPage((prev) => Math.max(prev - 1, 1))}>Prev</button>
            <span>Page {userCurrentPage} of {userTotalPages}</span>
            <button type="button" className="table-link action-chip action-chip-neutral" disabled={userCurrentPage >= userTotalPages} onClick={() => setLocationUserPage((prev) => Math.min(prev + 1, userTotalPages))}>Next</button>
          </div>

          <div className="table-shell">
            <table className="data-table expandable-rows-table">
              <thead><tr><th>Device</th><th>Phone</th><th>Owner</th><th>Actions</th></tr></thead>
              <tbody>
                {pagedDevices.map((entry) => {
                  const rowKey = `location-device-${entry.id || entry.deviceId || entry.phoneNumber}`
                  const isExpanded = expandedDeviceRowId === rowKey
                  const toggleExpanded = () => setExpandedDeviceRowId((prev) => (prev === rowKey ? null : rowKey))
                  return (
                    <Fragment key={rowKey}>
                      <tr className={`expandable-row ${isExpanded ? 'is-expanded' : ''}`} onClick={toggleExpanded}>
                        <td>{entry.name || entry.deviceName || '-'}</td>
                        <td>{entry.phoneNumber || '-'}</td>
                        <td>{resolveDeviceMeta(entry).ownerName}</td>
                        <td><button className="table-link" type="button" onClick={(event) => { event.stopPropagation(); openDeviceSettings(entry) }}>Open Device Page</button></td>
                      </tr>
                      {isExpanded ? (
                        <tr className="expandable-row-detail">
                          <td colSpan={4}>
                            <div className="expand-detail-panel">
                              <div><span>Device</span><strong>{entry.name || entry.deviceName || '-'}</strong></div>
                              <div><span>Phone</span><strong>{entry.phoneNumber || '-'}</strong></div>
                              <div><span>Owner</span><strong>{resolveDeviceMeta(entry).ownerName}</strong></div>
                              <div><span>Location</span><strong>{resolveDeviceMeta(entry).ownerLocation}</strong></div>
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
          <div className="table-pagination">
            <button type="button" className="table-link action-chip action-chip-neutral" disabled={deviceCurrentPage <= 1} onClick={() => setLocationDevicePage((prev) => Math.max(prev - 1, 1))}>Prev</button>
            <span>Page {deviceCurrentPage} of {deviceTotalPages}</span>
            <button type="button" className="table-link action-chip action-chip-neutral" disabled={deviceCurrentPage >= deviceTotalPages} onClick={() => setLocationDevicePage((prev) => Math.min(prev + 1, deviceTotalPages))}>Next</button>
          </div>
        </>
      )}
    </section>
  )
}
