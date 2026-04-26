import AppIcon from '../../../components/icons/AppIcon'
import { Fragment, useState } from 'react'

export default function CompaniesPage({
  companySearch,
  setCompanySearch,
  pagedCompanies,
  companiesPage,
  setCompaniesPage,
  setShowCompanyModal,
  onEditCompany
}) {
  const [expandedRowId, setExpandedRowId] = useState(null)

  return (
    <section className="card-like section-panel">
      <div className="section-head">
        <h2 className="section-title">Companies</h2>
        <button className="mini-action" onClick={() => setShowCompanyModal(true)}><AppIcon name="plus" className="btn-icon" />Add Company</button>
      </div>
      <div className="table-controls">
        <input
          placeholder="Search company name or details..."
          value={companySearch}
          onChange={(event) => setCompanySearch(event.target.value)}
        />
      </div>
      <div className="table-shell table-shell-tall">
        <table className="data-table expandable-rows-table">
          <thead><tr><th>Name</th><th>Details</th><th>Locations</th><th>Users</th><th>Devices</th><th>Actions</th></tr></thead>
          <tbody>
            {pagedCompanies.rows.map((company) => {
              const rowKey = String(company.id || company.name)
              const isExpanded = expandedRowId === rowKey
              const toggleExpanded = () => setExpandedRowId((prev) => (prev === rowKey ? null : rowKey))
              return (
                <Fragment key={rowKey}>
                  <tr className={`expandable-row ${isExpanded ? 'is-expanded' : ''}`} onClick={toggleExpanded}>
                    <td>{company.companyName || company.company_name || company.name || '-'}</td>
                    <td>{company.details || '-'}</td>
                    <td>{company.locationsCount ?? company.locations_count ?? 0}</td>
                    <td>{company.usersCount ?? company.users_count ?? 0}</td>
                    <td>{company.devicesCount ?? company.devices_count ?? 0}</td>
                    <td>
                      <button className="table-link" type="button" onClick={(event) => { event.stopPropagation(); onEditCompany(company) }}>Configure</button>
                    </td>
                  </tr>
                  {isExpanded ? (
                    <tr className="expandable-row-detail">
                      <td colSpan={6}>
                        <div className="expand-detail-panel">
                          <div><span>Company</span><strong>{company.companyName || company.company_name || company.name || '-'}</strong></div>
                          <div><span>Locations</span><strong>{company.locationsCount ?? company.locations_count ?? 0}</strong></div>
                          <div><span>Users</span><strong>{company.usersCount ?? company.users_count ?? 0}</strong></div>
                          <div><span>Devices</span><strong>{company.devicesCount ?? company.devices_count ?? 0}</strong></div>
                          <div><span>Details</span><strong>{company.details || '-'}</strong></div>
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
        <button type="button" className="table-link action-chip action-chip-neutral" disabled={companiesPage <= 1} onClick={() => setCompaniesPage((prev) => Math.max(prev - 1, 1))}>Prev</button>
        <span>Page {companiesPage} of {pagedCompanies.totalPages}</span>
        <button type="button" className="table-link action-chip action-chip-neutral" disabled={companiesPage >= pagedCompanies.totalPages} onClick={() => setCompaniesPage((prev) => Math.min(prev + 1, pagedCompanies.totalPages))}>Next</button>
      </div>
    </section>
  )
}
