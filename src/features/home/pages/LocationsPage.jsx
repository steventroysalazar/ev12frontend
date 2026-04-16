import AppIcon from '../../../components/icons/AppIcon'

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
      <div className="table-shell">
        <table className="data-table">
          <thead><tr><th>Name</th><th>Details</th><th>User Count</th><th>Device Count</th><th>Actions</th></tr></thead>
          <tbody>
            {pagedLocations.rows.map((l) => (
              <tr key={l.id || l.name}>
                <td>{l.name || '-'}</td>
                <td>{l.details || '-'}</td>
                <td>{l.userCount || l.users?.length || 0}</td>
                <td>{l.deviceCount || l.devices?.length || 0}</td>
                <td>
                  <button className="table-link" type="button" onClick={() => openLocationDetailPage(l)}>View Page</button>
                </td>
              </tr>
            ))}
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
