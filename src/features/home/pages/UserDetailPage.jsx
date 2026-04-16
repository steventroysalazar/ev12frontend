import { useMemo, useState } from 'react'

export default function UserDetailPage({
  selectedUser,
  roleLabel,
  devices,
  userForm,
  setUserForm,
  onSaveUser,
  openDeviceSettings,
  userDevicePage,
  setUserDevicePage,
  onBack
}) {
  const [isEditing, setIsEditing] = useState(false)
  const devicePageSize = 5

  const assignedDevices = devices.filter((entry) => String(entry.ownerUserId || entry.userId || entry.user_id || entry.owner?.id || entry.app_user?.id || '') === String(selectedUser?.id || ''))

  const totalPages = Math.max(1, Math.ceil(assignedDevices.length / devicePageSize))
  const currentPage = Math.min(Math.max(userDevicePage, 1), totalPages)
  const start = (currentPage - 1) * devicePageSize
  const pagedDevices = assignedDevices.slice(start, start + devicePageSize)

  const fullName = useMemo(() => {
    const firstName = (userForm.firstName || '').trim()
    const lastName = (userForm.lastName || '').trim()
    return `${firstName} ${lastName}`.trim()
  }, [userForm.firstName, userForm.lastName])

  const resetFormFromUser = () => {
    if (!selectedUser) return
    setUserForm((prev) => ({
      ...prev,
      email: selectedUser.email || '',
      firstName: selectedUser.firstName || selectedUser.first_name || '',
      lastName: selectedUser.lastName || selectedUser.last_name || '',
      contactNumber: selectedUser.contactNumber || selectedUser.contact_number || '',
      address: selectedUser.address || '',
      userRole: Number(selectedUser.userRole || selectedUser.role || selectedUser.user_role || 3),
      locationId: selectedUser.locationId || selectedUser.location_id || selectedUser.location?.id || '',
      managerId: selectedUser.managerId || selectedUser.manager_id || selectedUser.manager?.id || ''
    }))
  }

  const applyChanges = async () => {
    await onSaveUser()
    setIsEditing(false)
  }

  const handleDiscard = () => {
    resetFormFromUser()
    setIsEditing(false)
  }

  const handleNameChange = (value) => {
    const parts = value.trim().split(/\s+/)
    const firstName = parts.shift() || ''
    const lastName = parts.join(' ')
    setUserForm((prev) => ({ ...prev, firstName, lastName }))
  }

  return (
    <section className="user-profile-shell">
      <div className="user-profile-header-row">
        <button className="user-profile-back" type="button" onClick={onBack}>‹</button>
        <h2 className="user-profile-title">User Profile</h2>
      </div>

      {!selectedUser ? (
        <p className="status">User not found. Select a user from the Users page.</p>
      ) : (
        <>
          <article className="user-profile-card">
            <div className="user-profile-card-header">
              <h3>{isEditing ? 'User Information' : 'User Details'}</h3>
              {!isEditing && (
                <button className="user-profile-edit-icon" type="button" onClick={() => setIsEditing(true)} aria-label="Edit user profile">✎</button>
              )}
            </div>

            <div className="user-profile-grid">
              <div>
                <label>Full name</label>
                <input
                  value={isEditing ? fullName : `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim() || selectedUser.name || '-'}
                  readOnly={!isEditing}
                  onChange={(event) => handleNameChange(event.target.value)}
                />
              </div>
              <div>
                <label>Email</label>
                <input
                  value={isEditing ? userForm.email : selectedUser.email || '-'}
                  readOnly={!isEditing}
                  onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))}
                />
              </div>
              <div>
                <label>Role</label>
                <input
                  value={roleLabel(isEditing ? userForm.userRole : selectedUser.userRole || selectedUser.role || selectedUser.user_role || '-')}
                  readOnly
                />
              </div>
              <div>
                <label>Contact Number</label>
                <input
                  value={isEditing ? userForm.contactNumber : selectedUser.contactNumber || selectedUser.contact_number || '-'}
                  readOnly={!isEditing}
                  onChange={(event) => setUserForm((prev) => ({ ...prev, contactNumber: event.target.value }))}
                />
              </div>
              <div>
                <label>Address</label>
                <input
                  value={isEditing ? userForm.address : selectedUser.address || '-'}
                  readOnly={!isEditing}
                  onChange={(event) => setUserForm((prev) => ({ ...prev, address: event.target.value }))}
                />
              </div>
              <div>
                <label>Location</label>
                <input value={selectedUser.locationName || selectedUser.location?.name || '-'} readOnly />
              </div>
            </div>

            {isEditing && (
              <div className="user-profile-edit-actions">
                <button className="user-btn user-btn-secondary" type="button" onClick={handleDiscard}>Discard Changes</button>
                <button className="user-btn user-btn-primary" type="button" onClick={applyChanges}>Apply Changes</button>
              </div>
            )}
          </article>

          <article className="user-profile-card user-devices-card">
              <div className="user-profile-card-header">
                <h3>Assigned Devices</h3>
              </div>

              <div className="table-shell user-devices-table-shell">
                <table className="data-table user-devices-table">
                  <thead><tr><th>Device</th><th>Phone</th><th>Version</th><th>Actions</th></tr></thead>
                  <tbody>
                    {pagedDevices.map((entry) => (
                      <tr key={`user-device-${entry.id || entry.deviceId || entry.phoneNumber}`}>
                        <td>{entry.name || entry.deviceName || '-'}</td>
                        <td>{entry.phoneNumber || '-'}</td>
                        <td>{entry.eviewVersion || entry.version || '-'}</td>
                        <td className="user-devices-action-cell"><button className="user-manage-btn" type="button" onClick={() => openDeviceSettings(entry)}>Manage</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="table-pagination user-device-pagination">
                <button type="button" className="table-link" disabled={currentPage <= 1} onClick={() => setUserDevicePage((prev) => Math.max(prev - 1, 1))}>Prev</button>
                <span>Page {currentPage} of {totalPages}</span>
                <button type="button" className="table-link" disabled={currentPage >= totalPages} onClick={() => setUserDevicePage((prev) => Math.min(prev + 1, totalPages))}>Next</button>
              </div>
            </article>
        </>
      )}
    </section>
  )
}
