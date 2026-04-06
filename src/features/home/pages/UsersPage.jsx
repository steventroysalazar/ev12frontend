import AppIcon from '../../../components/icons/AppIcon'
import { useState } from 'react'

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
  roleLabel,
  getUserDevices
}) {
  const [deviceSearchByUser, setDeviceSearchByUser] = useState({})
  const [devicePageByUser, setDevicePageByUser] = useState({})
  const devicePageSize = 20

  const getRowUserKey = (user) => String(user.id || user.email || user.name || 'user')
  const getDevicePanel = (user) => {
    const userKey = getRowUserKey(user)
    const allDevices = getUserDevices(user)
    const search = (deviceSearchByUser[userKey] || '').trim().toLowerCase()
    const filtered = allDevices.filter((entry) => {
      const text = `${entry.name || entry.deviceName || ''} ${entry.phoneNumber || ''} ${entry.externalDeviceId || entry.deviceId || ''}`.toLowerCase()
      return !search || text.includes(search)
    })

    const totalPages = Math.max(1, Math.ceil(filtered.length / devicePageSize))
    const currentPage = Math.min(Math.max(devicePageByUser[userKey] || 1, 1), totalPages)
    const start = (currentPage - 1) * devicePageSize
    const pageRows = filtered.slice(start, start + devicePageSize)
    return { allDevices, search, filtered, totalPages, currentPage, pageRows, userKey }
  }

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
          <option value="qview admin">QView Admin</option>
          <option value="manager">Manager</option>
          <option value="user">User</option>
        </select>
      </div>
      <div className="table-shell">
        <table className="data-table">
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
                    const panel = getDevicePanel(u)
                    if (!panel.allDevices.length) return <span className="status">No devices</span>
                    return (
                      <details className="inline-devices-dropdown">
                        <summary>{panel.allDevices.length} device{panel.allDevices.length === 1 ? '' : 's'}</summary>
                        <div className="inline-devices-content">
                          <input
                            placeholder="Search devices..."
                            value={panel.search}
                            onChange={(event) => {
                              const value = event.target.value
                              setDeviceSearchByUser((prev) => ({ ...prev, [panel.userKey]: value }))
                              setDevicePageByUser((prev) => ({ ...prev, [panel.userKey]: 1 }))
                            }}
                          />
                          <ul>
                            {panel.pageRows.map((entry) => (
                              <li key={`user-table-device-${u.id || u.email}-${entry.id || entry.deviceId || entry.phoneNumber}`}>
                                <strong>{entry.name || entry.deviceName || 'Unnamed device'}</strong>
                                <span>{entry.phoneNumber || '-'}</span>
                              </li>
                            ))}
                          </ul>
                          {panel.filtered.length > devicePageSize ? (
                            <div className="inline-devices-pagination">
                              <button type="button" className="table-link" disabled={panel.currentPage <= 1} onClick={() => setDevicePageByUser((prev) => ({ ...prev, [panel.userKey]: Math.max(panel.currentPage - 1, 1) }))}>Prev</button>
                              <span>{panel.currentPage}/{panel.totalPages}</span>
                              <button type="button" className="table-link" disabled={panel.currentPage >= panel.totalPages} onClick={() => setDevicePageByUser((prev) => ({ ...prev, [panel.userKey]: Math.min(panel.currentPage + 1, panel.totalPages) }))}>Next</button>
                            </div>
                          ) : null}
                        </div>
                      </details>
                    )
                  })()}
                </td>
                <td>
                  <button className="table-link" type="button" onClick={() => openUserDetailPage(u)}>View Page</button>
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
