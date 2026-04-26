import React from 'react'
import AppIcon from '../../../components/icons/AppIcon'

export default function UsersPage({
  loadLocations,
  loadUsers,
  loadCompanies,
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
  const [deviceSearchByUser, setDeviceSearchByUser] = React.useState({})
  const [devicePageByUser, setDevicePageByUser] = React.useState({})
  const [openDevicesByUser, setOpenDevicesByUser] = React.useState({})
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
    <section className="card-like section-panel users-list-panel">
      <div className="section-head">
        <h2 className="section-title">All Users</h2>
        <button className="mini-action users-create-btn" onClick={async () => { await Promise.all([loadLocations(), loadUsers(), loadCompanies()]); setShowUserModal(true) }}><AppIcon name="plusUser" className="btn-icon" />Create User</button>
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
          <option value="company admin">Company Admin</option>
          <option value="portal user">Portal User</option>
          <option value="mobile app user">Mobile App User</option>
        </select>
      </div>
      <div className="table-shell users-table-shell">
        <table className="data-table users-data-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Contact</th><th>Location</th><th>Devices</th><th>Actions</th></tr></thead>
          <tbody>
            {pagedUsers.rows.map((u) => (
              <tr key={u.id || u.email}>
                <td>{`${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name || '-'}</td>
                <td>{u.email || '-'}</td>
                <td>{roleLabel(u.userRole || u.role || u.user_role || '-')}</td>
                <td>{u.contactNumber || '-'}</td>
                <td>{u.locationName || u.location?.name || '-'}</td>
                <td>
                  {(() => {
                    const panel = getDevicePanel(u)
                    if (!panel.allDevices.length) return <span className="status">No devices</span>
                    return (
                      <div className="inline-devices-dropdown">
                        <div className="users-device-summary">
                          <button
                            type="button"
                            className="users-device-trigger"
                            onClick={() => setOpenDevicesByUser((prev) => ({ ...prev, [panel.userKey]: !prev[panel.userKey] }))}
                          >
                            <span>{panel.allDevices.length} device{panel.allDevices.length === 1 ? '' : 's'}</span>
                            <span className={`users-device-chevron ${openDevicesByUser[panel.userKey] ? 'is-open' : ''}`} aria-hidden="true">
                              <AppIcon name="chevronDown" className="users-device-chevron-icon" />
                            </span>
                          </button>
                        </div>
                        {openDevicesByUser[panel.userKey] ? (
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
                          <div className="inline-devices-table-wrap">
                            <table className="inline-devices-table">
                              <thead>
                                <tr><th>Device</th><th>Phone</th></tr>
                              </thead>
                              <tbody>
                                {panel.pageRows.map((entry) => (
                                  <tr key={`user-table-device-${u.id || u.email}-${entry.id || entry.deviceId || entry.phoneNumber}`}>
                                    <td>{entry.name || entry.deviceName || 'Unnamed device'}</td>
                                    <td>{entry.phoneNumber || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {panel.filtered.length > devicePageSize ? (
                            <div className="inline-devices-pagination">
                              <button type="button" className="table-link" disabled={panel.currentPage <= 1} onClick={() => setDevicePageByUser((prev) => ({ ...prev, [panel.userKey]: Math.max(panel.currentPage - 1, 1) }))}>Prev</button>
                              <span>{panel.currentPage}/{panel.totalPages}</span>
                              <button type="button" className="table-link" disabled={panel.currentPage >= panel.totalPages} onClick={() => setDevicePageByUser((prev) => ({ ...prev, [panel.userKey]: Math.min(panel.currentPage + 1, panel.totalPages) }))}>Next</button>
                            </div>
                          ) : null}
                          </div>
                        ) : null}
                      </div>
                    )
                  })()}
                </td>
                <td className="users-actions-cell">
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
