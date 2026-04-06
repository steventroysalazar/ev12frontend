export default function UserDetailPage({
  selectedUser,
  roleLabel,
  devices,
  userForm,
  setUserForm,
  onSaveUser,
  openDeviceSettings,
  userDeviceSearch,
  setUserDeviceSearch,
  userDevicePage,
  setUserDevicePage,
  onBack
}) {
  const devicePageSize = 20

  const assignedDevices = devices.filter((entry) => String(entry.ownerUserId || entry.userId || entry.user_id || entry.owner?.id || entry.app_user?.id || '') === String(selectedUser?.id || ''))
  const filteredDevices = assignedDevices.filter((entry) => {
    const text = `${entry.name || entry.deviceName || ''} ${entry.phoneNumber || ''} ${entry.eviewVersion || entry.version || ''} ${entry.externalDeviceId || entry.external_device_id || ''}`.toLowerCase()
    return !userDeviceSearch.trim() || text.includes(userDeviceSearch.trim().toLowerCase())
  })
  const totalPages = Math.max(1, Math.ceil(filteredDevices.length / devicePageSize))
  const currentPage = Math.min(Math.max(userDevicePage, 1), totalPages)
  const start = (currentPage - 1) * devicePageSize
  const pagedDevices = filteredDevices.slice(start, start + devicePageSize)

  return (
    <section className="card-like section-panel">
      <div className="section-head">
        <h2 className="section-title">User Page</h2>
        <button className="table-link action-chip action-chip-neutral" type="button" onClick={onBack}>← Back to Users</button>
      </div>
      {!selectedUser ? (
        <p className="status">User not found. Select a user from the Users page.</p>
      ) : (
        <>
          <article className="card-like detail-overview-card">
            <p className="status-success">Single-page view for {`${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim() || selectedUser.email || 'user'}.</p>
            <div className="field-grid two-col">
              <div><label>Full name</label><input value={`${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim() || selectedUser.name || '-'} readOnly /></div>
              <div><label>Email</label><input value={selectedUser.email || '-'} readOnly /></div>
              <div><label>Role</label><input value={roleLabel(selectedUser.userRole || selectedUser.role || selectedUser.user_role || '-')} readOnly /></div>
              <div><label>Contact Number</label><input value={selectedUser.contactNumber || selectedUser.contact_number || '-'} readOnly /></div>
              <div><label>Address</label><input value={selectedUser.address || '-'} readOnly /></div>
              <div><label>Location</label><input value={selectedUser.locationName || selectedUser.location?.name || '-'} readOnly /></div>
            </div>
          </article>

          <article className="card-like detail-edit-card">
            <div className="section-head">
              <h3 className="block-title">Edit User Information</h3>
              <button className="mini-action" type="button" onClick={onSaveUser}>Save User</button>
            </div>
            <div className="field-grid two-col">
              <input placeholder="Email" value={userForm.email} onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))} />
              <select value={userForm.userRole} onChange={(event) => setUserForm((prev) => ({ ...prev, userRole: event.target.value }))}>
                <option value={1}>QView Admin</option>
                <option value={2}>Manager</option>
                <option value={3}>User</option>
              </select>
              <input placeholder="First Name" value={userForm.firstName} onChange={(event) => setUserForm((prev) => ({ ...prev, firstName: event.target.value }))} />
              <input placeholder="Last Name" value={userForm.lastName} onChange={(event) => setUserForm((prev) => ({ ...prev, lastName: event.target.value }))} />
              <input placeholder="Contact Number" value={userForm.contactNumber} onChange={(event) => setUserForm((prev) => ({ ...prev, contactNumber: event.target.value }))} />
              <input placeholder="Address" value={userForm.address} onChange={(event) => setUserForm((prev) => ({ ...prev, address: event.target.value }))} />
            </div>
          </article>

          <div className="section-head">
            <h3 className="block-title">Assigned Devices</h3>
            <input placeholder="Search devices..." value={userDeviceSearch} onChange={(event) => { setUserDeviceSearch(event.target.value); setUserDevicePage(1) }} />
          </div>
          <div className="table-shell">
            <table className="data-table">
              <thead><tr><th>Device</th><th>Phone</th><th>Version</th><th>Actions</th></tr></thead>
              <tbody>
                {pagedDevices.map((entry) => (
                  <tr key={`user-device-${entry.id || entry.deviceId || entry.phoneNumber}`}>
                    <td>{entry.name || entry.deviceName || '-'}</td>
                    <td>{entry.phoneNumber || '-'}</td>
                    <td>{entry.eviewVersion || entry.version || '-'}</td>
                    <td><button className="table-link" type="button" onClick={() => openDeviceSettings(entry)}>Open Device Page</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-pagination">
            <button type="button" className="table-link action-chip action-chip-neutral" disabled={currentPage <= 1} onClick={() => setUserDevicePage((prev) => Math.max(prev - 1, 1))}>Prev</button>
            <span>Page {currentPage} of {totalPages}</span>
            <button type="button" className="table-link action-chip action-chip-neutral" disabled={currentPage >= totalPages} onClick={() => setUserDevicePage((prev) => Math.min(prev + 1, totalPages))}>Next</button>
          </div>
        </>
      )}
    </section>
  )
}
