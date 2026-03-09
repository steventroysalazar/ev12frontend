import { useCallback, useEffect, useMemo, useState } from 'react'
import Sidebar from '../../components/sidebar/Sidebar'
import { fetchJsonWithFallback } from '../../lib/apiClient'
import './home.css'

const deviceRows = [
  ['Device Name', 'Lorem - EV12'],
  ['Device Phone Number', '+639108653532'],
  ['Owner User', 'John Doe'],
  ['Owner Location', 'Sydney, Australia'],
  ['Last reply', '04-03-2026 23:15'],
  ['Battery status', '74%']
]

const initialLocationForm = { name: '', details: '' }
const initialUserForm = { email: '', password: '', firstName: '', lastName: '', contactNumber: '', address: '', userRole: 3, locationId: '', managerId: '' }
const initialDeviceForm = { name: '', phoneNumber: '', ownerUserId: '', locationId: '' }

const roleLabel = (role) => ({ 1: 'Super Admin', 2: 'Manager', 3: 'User' }[Number(role)] || 'User')

export default function HomeView({ onLogout, loading, fetchReplies, requestLocationUpdate, repliesCount, authToken, sendConfig, user }) {
  const [activeSection, setActiveSection] = useState('dashboard')
  const [users, setUsers] = useState([])
  const [locations, setLocations] = useState([])
  const [devices, setDevices] = useState([])
  const [dataStatus, setDataStatus] = useState('')
  const [actionStatus, setActionStatus] = useState({ type: '', message: '' })

  const [showUserModal, setShowUserModal] = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [showDeviceModal, setShowDeviceModal] = useState(false)
  const [locationForm, setLocationForm] = useState(initialLocationForm)
  const [userForm, setUserForm] = useState(initialUserForm)
  const [deviceForm, setDeviceForm] = useState(initialDeviceForm)

  const fetchJson = useCallback(async (url, options = {}) => fetchJsonWithFallback(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(authToken ? { Authorization: authToken } : {}), ...(options.headers || {}) }
  }), [authToken])

  const loadUsers = useCallback(async () => {
    const data = await fetchJson('/api/users', { headers: {} })
    setUsers(Array.isArray(data) ? data : data.users || [])
  }, [fetchJson])

  const loadLocations = useCallback(async () => {
    const data = await fetchJson('/api/locations', { headers: {} })
    setLocations(Array.isArray(data) ? data : data.locations || [])
  }, [fetchJson])

  const loadDevices = useCallback(async () => {
    try {
      const data = await fetchJson('/api/devices', { headers: {} })
      setDevices(Array.isArray(data) ? data : data.devices || [])
    } catch {
      const data = await fetchJson('/api/users', { headers: {} })
      const usersList = Array.isArray(data) ? data : data.users || []
      setDevices(usersList.flatMap((u) => Array.isArray(u.devices) ? u.devices.map((d) => ({ ...d, owner: u })) : []))
    }
  }, [fetchJson])

  useEffect(() => {
    const load = async () => {
      try {
        if (activeSection === 'users') await loadUsers()
        if (activeSection === 'locations') await loadLocations()
        if (activeSection === 'devices') await loadDevices()
        if (activeSection === 'dashboard') await Promise.all([loadUsers(), loadLocations(), loadDevices()])
        setDataStatus('')
      } catch (error) {
        setDataStatus(`Data fetch failed: ${error.message}`)
      }
    }
    load()
  }, [activeSection, loadUsers, loadLocations, loadDevices])

  const metrics = useMemo(() => [
    { label: 'TOTAL USERS', value: users.length },
    { label: 'TOTAL DEVICES', value: devices.length },
    { label: 'TOTAL LOCATIONS', value: locations.length },
    { label: 'RECENT REPLIES', value: repliesCount || 0 }
  ], [users.length, devices.length, locations.length, repliesCount])

  const managers = users.filter((u) => Number(u.userRole) === 2)

  const handleCreateLocation = async () => {
    try {
      if (!locationForm.name.trim()) throw new Error('Location name is required')
      await fetchJson('/api/locations', { method: 'POST', body: JSON.stringify({ name: locationForm.name.trim(), details: locationForm.details.trim() }) })
      setActionStatus({ type: 'success', message: 'Location created successfully.' })
      setLocationForm(initialLocationForm)
      setShowLocationModal(false)
      await loadLocations()
    } catch (error) { setActionStatus({ type: 'error', message: `Create location failed: ${error.message}` }) }
  }

  const handleCreateUser = async () => {
    try {
      if (!userForm.email.trim() || !userForm.password.trim()) throw new Error('Email and password are required')
      const payload = { ...userForm, userRole: Number(userForm.userRole), locationId: userForm.locationId ? Number(userForm.locationId) : null, managerId: userForm.managerId ? Number(userForm.managerId) : null }
      await fetchJson('/api/users', { method: 'POST', body: JSON.stringify(payload) })
      setActionStatus({ type: 'success', message: 'User created successfully.' })
      setUserForm(initialUserForm)
      setShowUserModal(false)
      await loadUsers()
    } catch (error) { setActionStatus({ type: 'error', message: `Create user failed: ${error.message}` }) }
  }

  const handleCreateDevice = async () => {
    try {
      if (!deviceForm.ownerUserId) throw new Error('Owner user is required')
      if (!deviceForm.name.trim() || !deviceForm.phoneNumber.trim()) throw new Error('Device name and phone number are required')
      const payload = { name: deviceForm.name.trim(), phoneNumber: deviceForm.phoneNumber.trim(), locationId: deviceForm.locationId ? Number(deviceForm.locationId) : null, ownerUserId: Number(deviceForm.ownerUserId) }
      await fetchJson('/api/devices', { method: 'POST', body: JSON.stringify(payload) })
      setActionStatus({ type: 'success', message: 'Device created successfully.' })
      setDeviceForm(initialDeviceForm)
      setShowDeviceModal(false)
      await loadDevices()
    } catch (error) { setActionStatus({ type: 'error', message: `Create device failed: ${error.message}` }) }
  }

  return (
    <div className="dashboard-frame">
      <header className="dashboard-topbar"><div className="brand">EV12 LOGO</div><div className="profile"><div><strong>{user?.firstName || 'Jane'} {user?.lastName || 'Doe'}</strong><small>Super Admin</small></div><span className="avatar-dot" /></div></header>
      <div className="home-shell"><Sidebar activeSection={activeSection} onChangeSection={setActiveSection} onLogout={onLogout} />
        <div className="dashboard-content">
          {dataStatus ? <p className="status-error">{dataStatus}</p> : null}
          {actionStatus.message ? <p className={actionStatus.type === 'error' ? 'status-error' : 'status-success'}>{actionStatus.message}</p> : null}

          {activeSection === 'dashboard' && <><div className="section-head"><h2 className="page-title">Dashboard</h2><div className="toolbar"><button className="mint" disabled={loading} onClick={sendConfig}>● Send Command</button><button disabled={loading} onClick={requestLocationUpdate}>● Request Location</button><button disabled={loading} onClick={fetchReplies}>● Fetch Replies</button></div></div>
            <section className="metric-grid">{metrics.map((m) => <article key={m.label} className="metric-card"><div><p>{m.label}</p><h3>{Number(m.value || 0)}</h3></div></article>)}</section>
            <article className="card-like"><h3>Device Overview</h3><div className="device-panel"><div className="device-photo-placeholder" /><dl>{deviceRows.map(([label, value]) => <div className="device-row" key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></div></article>
          </>}

          {activeSection === 'users' && <section className="card-like section-panel"><div className="section-head"><h2 className="page-title">Users</h2><button className="mini-action" onClick={async () => { await Promise.all([loadLocations(), loadUsers()]); setShowUserModal(true) }}>+ Create User</button></div>
            <table className="data-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Contact</th><th>Location</th><th>Manager</th><th>Device Count</th></tr></thead><tbody>{users.map((u) => <tr key={u.id || u.email}><td>{`${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name || '-'}</td><td>{u.email || '-'}</td><td>{roleLabel(u.userRole)}</td><td>{u.contactNumber || '-'}</td><td>{u.location?.name || u.locationName || '-'}</td><td>{u.manager?.firstName || u.managerName || 'N/A'}</td><td><span className="tiny-pill">{u.devices?.length || 0}</span></td></tr>)}</tbody></table>
          </section>}

          {activeSection === 'locations' && <section className="card-like section-panel"><div className="section-head"><h2 className="page-title">Location</h2><button className="mini-action" onClick={() => setShowLocationModal(true)}>+ Create Location</button></div>
            <table className="data-table"><thead><tr><th>Location</th><th>Details</th><th>User Count</th><th>Device Count</th></tr></thead><tbody>{locations.map((l) => <tr key={l.id || l.name}><td>{l.name || '-'}</td><td>{l.details || '-'}</td><td><span className="tiny-pill">{l.userCount || l.users?.length || 0}</span></td><td><span className="tiny-pill">{l.deviceCount || l.devices?.length || 0}</span></td></tr>)}</tbody></table>
          </section>}

          {activeSection === 'devices' && <section className="card-like section-panel"><div className="section-head"><h2 className="page-title">Devices</h2><button className="mini-action" onClick={async () => { await Promise.all([loadUsers(), loadLocations()]); setShowDeviceModal(true) }}>+ Add Device</button></div>
            <table className="data-table"><thead><tr><th>Device Name</th><th>Phone Number</th><th>Owner</th><th>Owner Role</th><th>Location</th></tr></thead><tbody>{devices.map((d) => <tr key={d.id || `${d.name}-${d.phoneNumber}`}><td>{d.name || d.deviceName || '-'}</td><td>{d.phoneNumber || '-'}</td><td>{`${d.owner?.firstName || d.ownerName || ''} ${d.owner?.lastName || ''}`.trim() || 'N/A'}</td><td>{roleLabel(d.owner?.userRole || d.ownerRole || 3)}</td><td>{d.location?.name || d.locationName || '-'}</td></tr>)}</tbody></table>
          </section>}

          {activeSection === 'replies' && <section className="card-like section-panel"><div className="section-head"><h2 className="page-title">Replies</h2><div className="toolbar"><button className="mint" disabled={loading} onClick={fetchReplies}>▶ Start Polling</button><button disabled={loading} onClick={fetchReplies}>↻ Refresh</button></div></div><p className="hint-text">Use Refresh to load latest inbound messages.</p></section>}
        </div>
      </div>

      {showUserModal && <div className="overlay" onClick={() => setShowUserModal(false)}><div className="modal" onClick={(e) => e.stopPropagation()}><h3>Create User</h3><div className="field-grid two-col"><input placeholder="First Name" value={userForm.firstName} onChange={(e) => setUserForm((p) => ({ ...p, firstName: e.target.value }))} /><input placeholder="Last Name" value={userForm.lastName} onChange={(e) => setUserForm((p) => ({ ...p, lastName: e.target.value }))} /><input placeholder="Email" value={userForm.email} onChange={(e) => setUserForm((p) => ({ ...p, email: e.target.value }))} /><input type="password" placeholder="Password" value={userForm.password} onChange={(e) => setUserForm((p) => ({ ...p, password: e.target.value }))} /><input placeholder="Address" value={userForm.address} onChange={(e) => setUserForm((p) => ({ ...p, address: e.target.value }))} /><input placeholder="Phone Number" value={userForm.contactNumber} onChange={(e) => setUserForm((p) => ({ ...p, contactNumber: e.target.value }))} /><select value={userForm.locationId} onChange={(e) => setUserForm((p) => ({ ...p, locationId: e.target.value }))}><option value="">Location (Optional)</option>{locations.map((l) => <option key={l.id || l.name} value={l.id || ''}>{l.name || 'Unknown location'}</option>)}</select><select value={userForm.userRole} onChange={(e) => setUserForm((p) => ({ ...p, userRole: Number(e.target.value) }))}><option value={3}>User</option><option value={2}>Manager</option><option value={1}>Super Admin</option></select><select value={userForm.managerId} onChange={(e) => setUserForm((p) => ({ ...p, managerId: e.target.value }))}><option value="">Manager</option>{managers.map((m) => <option key={m.id || m.email} value={m.id || ''}>{`${m.firstName || ''} ${m.lastName || ''}`.trim() || m.email}</option>)}</select></div><div className="modal-actions"><button className="ghost" onClick={() => setShowUserModal(false)}>Cancel</button><button className="mini-action" onClick={handleCreateUser}>Create Account</button></div></div></div>}

      {showLocationModal && <div className="overlay" onClick={() => setShowLocationModal(false)}><div className="modal small" onClick={(e) => e.stopPropagation()}><h3>Create Location</h3><div className="field-grid"><input placeholder="Location Name" value={locationForm.name} onChange={(e) => setLocationForm((p) => ({ ...p, name: e.target.value }))} /><textarea rows={3} placeholder="Details" value={locationForm.details} onChange={(e) => setLocationForm((p) => ({ ...p, details: e.target.value }))} /></div><div className="modal-actions"><button className="ghost" onClick={() => setShowLocationModal(false)}>Cancel</button><button className="mini-action" onClick={handleCreateLocation}>Create Location</button></div></div></div>}

      {showDeviceModal && <div className="overlay" onClick={() => setShowDeviceModal(false)}><div className="modal small" onClick={(e) => e.stopPropagation()}><h3>Add Device</h3><div className="field-grid"><input placeholder="Device Name" value={deviceForm.name} onChange={(e) => setDeviceForm((p) => ({ ...p, name: e.target.value }))} /><input placeholder="Phone Number" value={deviceForm.phoneNumber} onChange={(e) => setDeviceForm((p) => ({ ...p, phoneNumber: e.target.value }))} /><select value={deviceForm.ownerUserId} onChange={(e) => setDeviceForm((p) => ({ ...p, ownerUserId: e.target.value }))}><option value="">Owner User</option>{users.map((u) => <option key={u.id || u.email} value={u.id || ''}>{`${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email}</option>)}</select></div><div className="modal-actions"><button className="ghost" onClick={() => setShowDeviceModal(false)}>Cancel</button><button className="mini-action" onClick={handleCreateDevice}>Add Device</button></div></div></div>}
    </div>
  )
}
