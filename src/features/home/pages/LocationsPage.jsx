import AppIcon from '../../../components/icons/AppIcon'
import { Fragment, useState } from 'react'

export default function LocationsPage({
  setShowLocationModal,
  locationSearch,
  setLocationSearch,
  locationDeviceFilter,
  setLocationDeviceFilter,
  pagedLocations,
  locationsPage,
  setLocationsPage,
  openLocationDetailPage
}) {
  const [expandedRowId, setExpandedRowId] = useState(null)

  return (
    <section className="card-like section-panel">
      <div className="section-head">
        <h2 className="section-title">Locations</h2>
        <button className="mini-action" onClick={() => setShowLocationModal(true)}><AppIcon name="plus" className="btn-icon" />Add Location</button>
      </div>
      <div className="table-controls">
        <input placeholder="Search location or details..." value={locationSearch} onChange={(event) => setLocationSearch(event.target.value)} />
        <select value={locationDeviceFilter} onChange={(event) => setLocationDeviceFilter(event.target.value)}>
          <option value="all">All locations</option>
          <option value="with-devices">With devices</option>
          <option value="without-devices">Without devices</option>
        </select>
      </div>
      <div className="table-shell table-shell-tall">
        <table className="data-table expandable-rows-table">
          <thead><tr><th>Name</th><th>Company</th><th>Details</th><th>User Count</th><th>Device Count</th><th>Actions</th></tr></thead>
          <tbody>
            {pagedLocations.rows.map((l) => {
              const rowKey = String(l.id || l.name)
              const isExpanded = expandedRowId === rowKey
              const toggleExpanded = () => setExpandedRowId((prev) => (prev === rowKey ? null : rowKey))
              return (
                <Fragment key={rowKey}>
                  <tr className={`expandable-row ${isExpanded ? 'is-expanded' : ''}`} onClick={toggleExpanded}>
                    <td>{l.name || '-'}</td>
                    <td>{l.companyName || l.company?.name || l.companyId || '-'}</td>
                    <td>{l.details || '-'}</td>
                    <td>{l.userCount || l.users?.length || 0}</td>
                    <td>{l.deviceCount || l.devices?.length || 0}</td>
                    <td>
                      <button className="table-link" type="button" onClick={(event) => { event.stopPropagation(); openLocationDetailPage(l) }}>View Page</button>
                    </td>
                  </tr>
                  {isExpanded ? (
                    <tr className="expandable-row-detail">
                      <td colSpan={6}>
                        <div className="expand-detail-panel">
                          <div><span>Location</span><strong>{l.name || '-'}</strong></div>
                          <div><span>Company</span><strong>{l.companyName || l.company?.name || l.companyId || '-'}</strong></div>
                          <div><span>Users</span><strong>{l.userCount || l.users?.length || 0}</strong></div>
                          <div><span>Devices</span><strong>{l.deviceCount || l.devices?.length || 0}</strong></div>
                          <div><span>Details</span><strong>{l.details || '-'}</strong></div>
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
        <button type="button" className="table-link action-chip action-chip-neutral" disabled={locationsPage <= 1} onClick={() => setLocationsPage((prev) => Math.max(prev - 1, 1))}>Prev</button>
        <span>Page {locationsPage} of {pagedLocations.totalPages}</span>
        <button type="button" className="table-link action-chip action-chip-neutral" disabled={locationsPage >= pagedLocations.totalPages} onClick={() => setLocationsPage((prev) => Math.min(prev + 1, pagedLocations.totalPages))}>Next</button>
      </div>
    </section>
  )
}
