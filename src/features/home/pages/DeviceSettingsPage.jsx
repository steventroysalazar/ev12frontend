import AppIcon from '../../../components/icons/AppIcon'

export default function DeviceSettingsPage({
  actionStatus,
  workspaceSettingQuery,
  setWorkspaceSettingQuery,
  workspaceSettingSuggestions,
  openWorkspaceSetting,
  activeDeviceSettingsSection,
  moveToDeviceSection,
  deviceWorkspaceLoading,
  sectionBadges,
  openConfigReview,
  configForm,
  configChangeRows,
  selectedWorkspaceDevice,
  workspaceDeviceMeta,
  hasPendingWorkspaceChanges,
  children
}) {
  return (
    <>
      <div className="workspace-status-row">
        {actionStatus.message
          ? <p className={actionStatus.type === 'error' ? 'status-error' : 'status-success'}>{actionStatus.message}</p>
          : <p className="status">Device workspace ready.</p>}
        <div className="workspace-setting-search">
          <input
            value={workspaceSettingQuery}
            onChange={(event) => setWorkspaceSettingQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && workspaceSettingSuggestions.length) {
                event.preventDefault()
                openWorkspaceSetting(workspaceSettingSuggestions[0])
              }
            }}
            placeholder="Find setting or command..."
            aria-label="Search settings"
          />
          {workspaceSettingQuery.trim() && workspaceSettingSuggestions.length ? (
            <div className="workspace-setting-dropdown">
              {workspaceSettingSuggestions.map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  className="workspace-setting-option"
                  onClick={() => openWorkspaceSetting(entry)}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="device-workspace-head card-like">
        <aside className="device-detail-sidebar">
          <div className="device-workspace-toolbar">
            <div className="workspace-setting-search">
              <input
                value={workspaceSettingQuery}
                onChange={(event) => setWorkspaceSettingQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && workspaceSettingSuggestions.length) {
                    event.preventDefault()
                    openWorkspaceSetting(workspaceSettingSuggestions[0])
                  }
                }}
                placeholder="Find setting or command..."
                aria-label="Search settings"
              />
              {workspaceSettingQuery.trim() && workspaceSettingSuggestions.length ? (
                <div className="workspace-setting-dropdown">
                  {workspaceSettingSuggestions.map((entry) => (
                    <button
                      key={entry.key}
                      type="button"
                      className="workspace-setting-option"
                      onClick={() => openWorkspaceSetting(entry)}
                    >
                      {entry.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="device-detail-nav">
            <button type="button" className={activeDeviceSettingsSection === 'device-detail-overview' ? 'is-active' : ''} onClick={() => moveToDeviceSection('device-detail-overview', { force: true })} disabled={deviceWorkspaceLoading}><span className="device-nav-dot"><AppIcon name="devices" className="btn-icon" /></span>Device Info <small>{sectionBadges['device-detail-overview']}</small></button>
            <button type="button" className={activeDeviceSettingsSection === 'device-detail-basic' ? 'is-active' : ''} onClick={() => moveToDeviceSection('device-detail-basic', { force: true })} disabled={deviceWorkspaceLoading}><span className="device-nav-dot"><AppIcon name="settings" className="btn-icon" /></span>Basic Config <small>{sectionBadges['device-detail-basic']}</small></button>
            <button type="button" className={activeDeviceSettingsSection === 'device-detail-advanced' ? 'is-active' : ''} onClick={() => moveToDeviceSection('device-detail-advanced', { force: true })} disabled={deviceWorkspaceLoading}><span className="device-nav-dot"><AppIcon name="settings" className="btn-icon" /></span>Advanced Config <small>{sectionBadges['device-detail-advanced']}</small></button>
            <button type="button" className={activeDeviceSettingsSection === 'device-detail-location' ? 'is-active' : ''} onClick={() => moveToDeviceSection('device-detail-location', { force: true })} disabled={deviceWorkspaceLoading}><span className="device-nav-dot"><AppIcon name="location" className="btn-icon" /></span>Live Location <small>{sectionBadges['device-detail-location']}</small></button>
            <button type="button" className={activeDeviceSettingsSection === 'device-detail-commands' ? 'is-active' : ''} onClick={() => moveToDeviceSection('device-detail-commands', { force: true })} disabled={deviceWorkspaceLoading}><span className="device-nav-dot"><AppIcon name="command" className="btn-icon" /></span>Send Commands <small>{sectionBadges['device-detail-commands']}</small></button>
          </div>
          <div className="device-workspace-actions">
            <button type="button" className="mini-action" onClick={openConfigReview} disabled={!configForm.deviceId || !configChangeRows.length}>Review &amp; Send</button>
          </div>
          <button type="button" className="device-back-button" onClick={() => moveToDeviceSection('devices')}>← Back to devices</button>
        </aside>
      </div>

      {selectedWorkspaceDevice ? (
        <section className="card-like workspace-device-context">
          <div className="workspace-device-context-head">
            <div>
              <h3>{selectedWorkspaceDevice.name || selectedWorkspaceDevice.deviceName || `Device ${selectedWorkspaceDevice.id || selectedWorkspaceDevice.deviceId || ''}`}</h3>
              <p>Phone {selectedWorkspaceDevice.phoneNumber || '-'} · IMEI {configForm.imei || selectedWorkspaceDevice.imei || '-'} · Owner {workspaceDeviceMeta?.ownerName || '-'}</p>
            </div>
            <div className="workspace-context-chips">
              <span className={`map-kpi-chip compact ${deviceWorkspaceLoading ? 'is-loading' : ''}`}>{deviceWorkspaceLoading ? 'Refreshing…' : 'Loaded'}</span>
              <span className="map-kpi-chip compact">{workspaceDeviceMeta?.ownerLocation || 'No location'}</span>
              <span className={`map-kpi-chip compact ${hasPendingWorkspaceChanges ? 'is-pending' : ''}`}>{hasPendingWorkspaceChanges ? 'Unsaved changes' : 'All changes saved'}</span>
            </div>
          </div>
        </section>
      ) : null}

      {children}
    </>
  )
}
