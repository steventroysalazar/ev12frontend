import AppIcon from '../../../components/icons/AppIcon'

export default function UsersPage({
  loadLocations,
  loadUsers,
  setShowUserModal,
  userSearch,
  setUserSearch,
  userRoleFilter,
  setUserRoleFilter,
  userLocationFilter,
  setUserLocationFilter,
  userLocationOptions,
  pagedUsers,
  usersPage,
  setUsersPage,
  openUserDetailPage,
  roleLabel,
  getUserDevices
}) {
  return (
    <section className="card-like section-panel users-list-panel">
      <div className="section-head">
        <h2 className="section-title">All Users</h2>
        <button className="mini-action users-create-btn" onClick={async () => { await Promise.all([loadLocations(), loadUsers()]); setShowUserModal(true) }}><AppIcon name="plusUser" className="btn-icon" />Create User</button>
      </div>
      <div className="table-controls users-table-controls">
        <input placeholder="Search by user, email, contact, location..." value={userSearch} onChange={(event) => setUserSearch(event.target.value)} />
        <select value={userLocationFilter} onChange={(event) => setUserLocationFilter(event.target.value)}>
          <option value="all">All locations</option>
          {userLocationOptions.map((entry) => (
            <option key={`users-location-filter-${entry.id}`} value={entry.id}>{entry.name}</option>
          ))}
        </select>
        <select value={userRoleFilter} onChange={(event) => setUserRoleFilter(event.target.value)}>
          <option value="all">All roles</option>
          <option value="qview admin">QView Admin</option>
          <option value="manager">Manager</option>
          <option value="user">User</option>
        </select>
      </div>
      <div className="table-shell users-table-shell">
        <table className="data-table users-data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Contact</th><th>Location</th><th>Manager</th><th>Devices</th><th>Actions</th></tr></thead>
          <tbody>
            {pagedUsers.rows.map((u) => (
              <tr key={u.id || u.email}>
                <td>{`${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name || '-'}</td>
                <td>{u.email || '-'}</td>
                <td>{roleLabel(u.userRole || u.role || u.user_role || '-')}</td>
                <td>{u.contactNumber || '-'}</td>
                <td>{u.locationName || u.location?.name || '-'}</td>
                <td>{u.managerName || u.manager?.firstName || '-'}</td>
                <td>
                  {(() => {
                    const devices = getUserDevices(u)
                    if (!devices.length) return 'No devices'
                    return `${devices.length} device${devices.length === 1 ? '' : 's'}`
                  })()}
                </td>
                <td>
                  <button className="table-link users-view-btn" type="button" onClick={() => openUserDetailPage(u)}>VIEW</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-pagination users-table-pagination">
        <button type="button" className="table-link action-chip action-chip-neutral" disabled={usersPage <= 1} onClick={() => setUsersPage((prev) => Math.max(prev - 1, 1))}>PREV</button>
        <span>PAGE {usersPage} of {pagedUsers.totalPages}</span>
        <button type="button" className="table-link action-chip action-chip-neutral" disabled={usersPage >= pagedUsers.totalPages} onClick={() => setUsersPage((prev) => Math.min(prev + 1, pagedUsers.totalPages))}>NEXT</button>
      </div>
    </section>
  )
}
