import AppIcon from '../../../components/icons/AppIcon'

export default function UsersPage({
  loadLocations,
  loadUsers,
  setShowUserModal,
  userSearch,
  setUserSearch,
  userRoleFilter,
  setUserRoleFilter,
  pagedUsers,
  usersPage,
  setUsersPage,
  openUserDetailPage,
  openEditUserModal
}) {
  return (
    <section className="card-like section-panel">
      <div className="section-head">
        <h2 className="section-title">Users</h2>
        <button className="mini-action" onClick={async () => { await Promise.all([loadLocations(), loadUsers()]); setShowUserModal(true) }}><AppIcon name="plusUser" className="btn-icon" />Create User</button>
      </div>
      <div className="table-controls">
        <input placeholder="Search user, email, contact, location..." value={userSearch} onChange={(event) => setUserSearch(event.target.value)} />
        <select value={userRoleFilter} onChange={(event) => setUserRoleFilter(event.target.value)}>
          <option value="all">All roles</option>
          <option value="super admin">Super Admin</option>
          <option value="manager">Manager</option>
          <option value="user">User</option>
        </select>
      </div>
      <div className="table-shell">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Contact</th><th>Location</th><th>Manager</th><th>Actions</th></tr></thead>
          <tbody>
            {pagedUsers.rows.map((u) => (
              <tr key={u.id || u.email}>
                <td>{`${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name || '-'}</td>
                <td>{u.email || '-'}</td>
                <td>{u.userRole || u.role || '-'}</td>
                <td>{u.contactNumber || '-'}</td>
                <td>{u.locationName || u.location?.name || '-'}</td>
                <td>{u.managerName || u.manager?.firstName || '-'}</td>
                <td>
                  <button className="table-link" type="button" onClick={() => openUserDetailPage(u)}>View Page</button>
                  <button className="table-link" type="button" onClick={() => openEditUserModal(u)}>Edit User</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-pagination">
        <button type="button" className="table-link action-chip action-chip-neutral" disabled={usersPage <= 1} onClick={() => setUsersPage((prev) => Math.max(prev - 1, 1))}>Prev</button>
        <span>Page {usersPage} of {pagedUsers.totalPages}</span>
        <button type="button" className="table-link action-chip action-chip-neutral" disabled={usersPage >= pagedUsers.totalPages} onClick={() => setUsersPage((prev) => Math.min(prev + 1, pagedUsers.totalPages))}>Next</button>
      </div>
    </section>
  )
}
