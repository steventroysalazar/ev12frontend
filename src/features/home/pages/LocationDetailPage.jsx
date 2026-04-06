export default function LocationDetailPage({
  selectedLocation,
  devices,
  resolveDeviceMeta,
  openDeviceSettings,
  onBack
}) {
  return (
    <section className="card-like section-panel">
      <div className="section-head">
        <h2 className="section-title">Location Page</h2>
        <button className="table-link action-chip action-chip-neutral" type="button" onClick={onBack}>← Back to Locations</button>
      </div>
      {!selectedLocation ? (
        <p className="status">Location not found. Select a location from the Locations page.</p>
      ) : (
        <>
          <p className="status-success">Single-page view for {selectedLocation.name || 'location'}.</p>
          <div className="field-grid two-col">
            <div><label>Location Name</label><input value={selectedLocation.name || '-'} readOnly /></div>
            <div><label>Details</label><input value={selectedLocation.details || '-'} readOnly /></div>
            <div><label>User Count</label><input value={String(selectedLocation.userCount || selectedLocation.users?.length || 0)} readOnly /></div>
            <div><label>Device Count</label><input value={String(selectedLocation.deviceCount || selectedLocation.devices?.length || 0)} readOnly /></div>
          </div>
          <div className="section-head">
            <h3 className="block-title">Devices in this Location</h3>
          </div>
          <div className="table-shell">
            <table className="data-table">
              <thead><tr><th>Device</th><th>Phone</th><th>Owner</th><th>Actions</th></tr></thead>
              <tbody>
                {devices.filter((entry) => String(entry.locationId || entry.location_id || entry.location?.id || '') === String(selectedLocation.id || '')).map((entry) => (
                  <tr key={`location-device-${entry.id || entry.deviceId || entry.phoneNumber}`}>
                    <td>{entry.name || entry.deviceName || '-'}</td>
                    <td>{entry.phoneNumber || '-'}</td>
                    <td>{resolveDeviceMeta(entry).ownerName}</td>
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
