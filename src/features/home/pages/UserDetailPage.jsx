export default function UserDetailPage({
  selectedUser,
  roleLabel,
  devices,
  openDeviceSettings,
  onBack
}) {
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
          <p className="status-success">Single-page view for {`${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim() || selectedUser.email || 'user'}.</p>
          <div className="field-grid two-col">
            <div><label>Full name</label><input value={`${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim() || selectedUser.name || '-'} readOnly /></div>
            <div><label>Email</label><input value={selectedUser.email || '-'} readOnly /></div>
            <div><label>Role</label><input value={roleLabel(selectedUser.userRole || selectedUser.role || selectedUser.user_role || '-')} readOnly /></div>
            <div><label>Contact Number</label><input value={selectedUser.contactNumber || selectedUser.contact_number || '-'} readOnly /></div>
            <div><label>Address</label><input value={selectedUser.address || '-'} readOnly /></div>
            <div><label>Location</label><input value={selectedUser.locationName || selectedUser.location?.name || '-'} readOnly /></div>
          </div>
          <div className="section-head">
            <h3 className="block-title">Assigned Devices</h3>
          </div>
          <div className="table-shell">
            <table className="data-table">
              <thead><tr><th>Device</th><th>Phone</th><th>Version</th><th>Actions</th></tr></thead>
              <tbody>
                {devices.filter((entry) => String(entry.ownerUserId || entry.userId || entry.user_id || entry.owner?.id || entry.app_user?.id || '') === String(selectedUser.id || '')).map((entry) => (
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
        </>
      )}
    </section>
  )
}
