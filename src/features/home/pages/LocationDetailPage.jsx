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
            <table className="data-table">
              <thead><tr><th>Name</th><th>Email</th><th>Contact</th></tr></thead>
              <tbody>
                {pagedUsers.map((entry) => (
                  <tr key={`location-user-${entry.id || entry.email}`}>
                    <td>{`${entry.firstName || ''} ${entry.lastName || ''}`.trim() || entry.name || '-'}</td>
                    <td>{entry.email || '-'}</td>
                    <td>{entry.contactNumber || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-pagination">
            <button type="button" className="table-link action-chip action-chip-neutral" disabled={userCurrentPage <= 1} onClick={() => setLocationUserPage((prev) => Math.max(prev - 1, 1))}>Prev</button>
            <span>Page {userCurrentPage} of {userTotalPages}</span>
            <button type="button" className="table-link action-chip action-chip-neutral" disabled={userCurrentPage >= userTotalPages} onClick={() => setLocationUserPage((prev) => Math.min(prev + 1, userTotalPages))}>Next</button>
          </div>

          <div className="table-shell">
            <table className="data-table">
              <thead><tr><th>Device</th><th>Phone</th><th>Owner</th><th>Actions</th></tr></thead>
              <tbody>
                {pagedDevices.map((entry) => (
                  <tr key={`location-device-${entry.id || entry.deviceId || entry.phoneNumber}`}>
                    <td>{entry.name || entry.deviceName || '-'}</td>
                    <td>{entry.phoneNumber || '-'}</td>
                    <td>{resolveDeviceMeta(entry).ownerName}</td>
                    <td><button className="table-link" type="button" onClick={() => openDeviceSettings(entry)}>Open Device Page</button></td>
                  </tr>
                ))}
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
