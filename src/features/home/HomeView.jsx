import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from '../../components/sidebar/Sidebar'
import AppIcon from '../../components/icons/AppIcon'
import { fetchJsonWithFallback, fetchWithFallback } from '../../lib/apiClient'
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
const initialUserForm = {
  email: '',
  password: '',
  firstName: '',
  lastName: '',
  contactNumber: '',
  address: '',
  userRole: 3,
  locationId: '',
  managerId: ''
}
const initialDeviceForm = { name: '', phoneNumber: '', ownerUserId: '', locationId: '' }

export default function HomeView({
  onLogout,
  gatewayBaseUrl,
  gatewayToken,
  setGatewayBaseUrl,
  setGatewayToken,
  configForm,
  setConfigForm,
  commandPreview,
  configStatus,
  configResult,
  sendConfig,
  loading,
  phone,
  message,
  setPhone,
  setMessage,
  sendMessage,
  fetchReplies,
  requestLocationUpdate,
  locationResult,
  status,
  formattedReplies,
  replies,
  repliesCount,
  authToken
}) {
  const [activeSection, setActiveSection] = useState('dashboard')
  const [selectedDevice, setSelectedDevice] = useState(null)

  const [showUserModal, setShowUserModal] = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [showDeviceModal, setShowDeviceModal] = useState(false)
  const [showEditUserModal, setShowEditUserModal] = useState(false)
  const [showEditLocationModal, setShowEditLocationModal] = useState(false)
  const [editingUserId, setEditingUserId] = useState(null)
  const [editingLocationId, setEditingLocationId] = useState(null)

  const [users, setUsers] = useState([])
  const [locations, setLocations] = useState([])
  const [devices, setDevices] = useState([])

  const [locationForm, setLocationForm] = useState(initialLocationForm)
  const [userForm, setUserForm] = useState(initialUserForm)
  const [deviceForm, setDeviceForm] = useState(initialDeviceForm)

  const [dataStatus, setDataStatus] = useState('')
  const [actionStatus, setActionStatus] = useState({ type: '', message: '' })
  const [autoFetchReplies, setAutoFetchReplies] = useState(false)
  const [webhookRaw, setWebhookRaw] = useState(null)
  const [webhookStatus, setWebhookStatus] = useState('')
  const webhookFingerprintRef = useRef('')

  const metrics = useMemo(
    () => [
      { label: 'TOTAL USERS', value: users.length, icon: 'users' },
      { label: 'TOTAL DEVICES', value: devices.length, icon: 'devices' },
      { label: 'TOTAL LOCATIONS', value: locations.length, icon: 'location' },
      { label: 'RECENT REPLIES', value: repliesCount || 0, icon: 'replies' }
    ],
    [users.length, devices.length, locations.length, repliesCount]
  )

  const toggle = (key) => setConfigForm((prev) => ({ ...prev, [key]: !prev[key] }))

  const getContacts = (form) => {
    if (Array.isArray(form.contacts) && form.contacts.length) return form.contacts.slice(0, 10)

    return [{
      slot: 1,
      name: form.contactName || '',
      phone: form.contactNumber || '',
      smsEnabled: form.contactSmsEnabled !== false,
      callEnabled: form.contactCallEnabled !== false
    }]
  }

  const updateContacts = (updater) => {
    setConfigForm((prev) => {
      const baseContacts = getContacts(prev)
      const updatedContacts = updater(baseContacts)
        .slice(0, 10)
        .map((contact, index) => ({
          slot: index + 1,
          name: contact.name || '',
          phone: contact.phone || '',
          smsEnabled: contact.smsEnabled !== false,
          callEnabled: contact.callEnabled !== false
        }))

      const primaryContact = updatedContacts.find((contact) => contact.phone.trim()) || updatedContacts[0] || {
        name: '',
        phone: '',
        smsEnabled: true,
        callEnabled: true
      }

      return {
        ...prev,
        contacts: updatedContacts,
        contactSlot: primaryContact.slot || 1,
        contactName: primaryContact.name,
        contactNumber: primaryContact.phone,
        contactSmsEnabled: primaryContact.smsEnabled,
        contactCallEnabled: primaryContact.callEnabled
      }
    })
  }

  const fetchJson = useCallback(
    async (url, options = {}) => {
      return fetchJsonWithFallback(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: authToken } : {}),
          ...(options.headers || {})
        }
      })
    },
    [authToken]
  )

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
      const flattened = usersList.flatMap((user) =>
        Array.isArray(user.devices) ? user.devices.map((device) => ({ ...device, owner: user })) : []
      )
      setDevices(flattened)
    }
  }, [fetchJson])

  useEffect(() => {
    const load = async () => {
      try {
        if (activeSection === 'users') await loadUsers()
        if (activeSection === 'locations') await loadLocations()
        if (activeSection === 'devices') await loadDevices()
        if (activeSection === 'dashboard') {
          await Promise.all([loadUsers(), loadLocations(), loadDevices()])
        }
        setDataStatus('')
      } catch (error) {
        setDataStatus(`Data fetch failed: ${error.message}`)
      }
    }

    load()
  }, [activeSection, loadUsers, loadLocations, loadDevices])

  useEffect(() => {
    if (activeSection !== 'replies' || !autoFetchReplies) return undefined

    fetchReplies()
    const intervalId = setInterval(() => {
      fetchReplies()
    }, 5000)

    return () => clearInterval(intervalId)
  }, [activeSection, autoFetchReplies, fetchReplies])

  const loadWebhookEvents = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setWebhookStatus('Loading webhook events...')

    const endpoints = ['/api/webhooks/ev12/events', 'http://localhost:8090/api/webhooks/ev12/events']
    let payload = null
    let lastError = null

    for (const endpoint of endpoints) {
      try {
        const { response } = await fetchWithFallback(endpoint, {
          headers: {
            ...(authToken ? { Authorization: authToken } : {})
          }
        })

        const body = await response.json().catch(() => ([]))
        if (!response.ok) throw new Error(body.error || body.message || `Failed ${endpoint}`)
        payload = body
        break
      } catch (error) {
        lastError = error
      }
    }

    if (!payload) {
      setWebhookStatus(`Webhook fetch failed: ${lastError?.message || 'Unknown error'}`)
      setWebhookRaw(null)
      webhookFingerprintRef.current = ''
      return
    }

    const getEventTime = (event) => new Date(event?.receivedAt || event?.timestamp || event?.createdAt || event?.date || 0).getTime()

    if (Array.isArray(payload)) {
      const latestEvents = payload
        .slice()
        .sort((a, b) => getEventTime(b) - getEventTime(a))
        .slice(0, 3)

      const nextFingerprint = JSON.stringify(latestEvents)
      const hadPrevious = webhookFingerprintRef.current !== ''
      const hasNewEvent = hadPrevious && webhookFingerprintRef.current !== nextFingerprint

      webhookFingerprintRef.current = nextFingerprint
      setWebhookRaw(latestEvents)
      setWebhookStatus(hasNewEvent ? 'New webhook event received. Showing latest 3 events.' : `Showing latest ${latestEvents.length} webhook event(s).`)
      return
    }

    const nextFingerprint = JSON.stringify(payload)
    const hadPrevious = webhookFingerprintRef.current !== ''
    const hasNewEvent = hadPrevious && webhookFingerprintRef.current !== nextFingerprint

    webhookFingerprintRef.current = nextFingerprint
    setWebhookRaw(payload)
    setWebhookStatus(hasNewEvent ? 'New webhook payload received.' : 'Loaded webhook payload.')
  }, [authToken])

  useEffect(() => {
    if (activeSection === 'webhooks') {
      loadWebhookEvents()
    }
  }, [activeSection, loadWebhookEvents])

  useEffect(() => {
    if (activeSection !== 'webhooks') return undefined

    const intervalId = setInterval(() => {
      loadWebhookEvents({ silent: true })
    }, 2000)

    return () => clearInterval(intervalId)
  }, [activeSection, loadWebhookEvents])

  const clearWebhookEvents = () => {
    webhookFingerprintRef.current = ''
    setWebhookRaw(null)
    setWebhookStatus('Webhook events cleared.')
  }

  const openDeviceSettings = (device) => {
    setSelectedDevice(device)
    setConfigForm((prev) => {
      const existingContacts = getContacts(prev)
      const seededContacts = [...existingContacts]
      const primaryName = device.ownerName || device.owner?.firstName || seededContacts[0]?.name || prev.contactName
      const primaryPhone = device.phoneNumber || seededContacts[0]?.phone || prev.contactNumber

      seededContacts[0] = {
        slot: 1,
        name: primaryName || '',
        phone: primaryPhone || '',
        smsEnabled: seededContacts[0]?.smsEnabled !== false,
        callEnabled: seededContacts[0]?.callEnabled !== false
      }

      return {
        ...prev,
        imei: device.imei || prev.imei,
        prefixName: device.name || device.deviceName || prev.prefixName,
        contacts: seededContacts.slice(0, 10),
        contactSlot: 1,
        contactNumber: primaryPhone || '',
        contactName: primaryName || ''
      }
    })
    setActionStatus({ type: 'success', message: `Opened settings for ${device.name || device.deviceName || 'device'}.` })
    setActiveSection('settings-basic')
  }

  const handleCreateLocation = async () => {
    try {
      if (!locationForm.name.trim()) throw new Error('Location name is required')
      await fetchJson('/api/locations', {
        method: 'POST',
        body: JSON.stringify({ name: locationForm.name.trim(), details: locationForm.details.trim() })
      })
      setActionStatus({ type: 'success', message: 'Location created successfully.' })
      setLocationForm(initialLocationForm)
      setShowLocationModal(false)
      await loadLocations()
    } catch (error) {
      setActionStatus({ type: 'error', message: `Create location failed: ${error.message}` })
    }
  }

  const handleCreateUser = async () => {
    try {
      if (!userForm.email.trim() || !userForm.password.trim()) throw new Error('Email and password are required')
      const payload = {
        ...userForm,
        userRole: Number(userForm.userRole),
        locationId: userForm.locationId ? Number(userForm.locationId) : null,
        managerId: userForm.managerId ? Number(userForm.managerId) : null
      }

      try {
        await fetchJson('/api/users', { method: 'POST', body: JSON.stringify(payload) })
      } catch {
        await fetchJson('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) })
      }

      setActionStatus({ type: 'success', message: 'User created successfully.' })
      setUserForm(initialUserForm)
      setShowUserModal(false)
      await loadUsers()
    } catch (error) {
      setActionStatus({ type: 'error', message: `Create user failed: ${error.message}` })
    }
  }

  const handleCreateDevice = async () => {
    try {
      if (!deviceForm.ownerUserId) throw new Error('Owner user is required')
      if (!deviceForm.name.trim() || !deviceForm.phoneNumber.trim()) throw new Error('Device name and phone number are required')

      const payload = {
        name: deviceForm.name.trim(),
        phoneNumber: deviceForm.phoneNumber.trim(),
        locationId: deviceForm.locationId ? Number(deviceForm.locationId) : null,
        ownerUserId: Number(deviceForm.ownerUserId)
      }

      try {
        await fetchJson(`/api/users/${payload.ownerUserId}/devices`, { method: 'POST', body: JSON.stringify(payload) })
      } catch {
        await fetchJson('/api/devices', { method: 'POST', body: JSON.stringify(payload) })
      }

      setActionStatus({ type: 'success', message: 'Device created successfully.' })
      setDeviceForm(initialDeviceForm)
      setShowDeviceModal(false)
      await loadDevices()
    } catch (error) {
      setActionStatus({ type: 'error', message: `Create device failed: ${error.message}` })
    }
  }



  const openEditUserModal = async (user) => {
    await Promise.all([loadLocations(), loadUsers()])
    setEditingUserId(user.id)
    setUserForm({
      email: user.email || '',
      password: '',
      firstName: user.firstName || user.first_name || '',
      lastName: user.lastName || user.last_name || '',
      contactNumber: user.contactNumber || user.contact_number || '',
      address: user.address || '',
      userRole: Number(user.userRole || user.role || user.user_role || 3),
      locationId: user.locationId || user.location_id || user.location?.id || '',
      managerId: user.managerId || user.manager_id || user.manager?.id || ''
    })
    setShowEditUserModal(true)
  }

  const openEditLocationModal = (location) => {
    setEditingLocationId(location.id)
    setLocationForm({
      name: location.name || '',
      details: location.details || ''
    })
    setShowEditLocationModal(true)
  }

  const handleUpdateUser = async () => {
    try {
      if (!editingUserId) throw new Error('User id is missing')
      if (!userForm.email.trim()) throw new Error('Email is required')

      const payload = {
        ...userForm,
        userRole: Number(userForm.userRole),
        locationId: userForm.locationId ? Number(userForm.locationId) : null,
        managerId: userForm.managerId ? Number(userForm.managerId) : null
      }

      try {
        await fetchJson(`/api/users/${editingUserId}`, { method: 'PUT', body: JSON.stringify(payload) })
      } catch {
        await fetchJson(`/api/users/${editingUserId}`, { method: 'PATCH', body: JSON.stringify(payload) })
      }

      setActionStatus({ type: 'success', message: 'User updated successfully.' })
      setShowEditUserModal(false)
      setEditingUserId(null)
      setUserForm(initialUserForm)
      await loadUsers()
    } catch (error) {
      setActionStatus({ type: 'error', message: `Update user failed: ${error.message}` })
    }
  }

  const handleUpdateLocation = async () => {
    try {
      if (!editingLocationId) throw new Error('Location id is missing')
      if (!locationForm.name.trim()) throw new Error('Location name is required')

      const payload = { name: locationForm.name.trim(), details: locationForm.details.trim() }

      try {
        await fetchJson(`/api/locations/${editingLocationId}`, { method: 'PUT', body: JSON.stringify(payload) })
      } catch {
        await fetchJson(`/api/locations/${editingLocationId}`, { method: 'PATCH', body: JSON.stringify(payload) })
      }

      setActionStatus({ type: 'success', message: 'Location updated successfully.' })
      setShowEditLocationModal(false)
      setEditingLocationId(null)
      setLocationForm(initialLocationForm)
      await loadLocations()
    } catch (error) {
      setActionStatus({ type: 'error', message: `Update location failed: ${error.message}` })
    }
  }

  const managers = users.filter((user) => Number(user.userRole) === 2)

  const roleLabel = (value) => {
    const normalized = String(value || '').trim().toUpperCase()
    if (normalized === 'SUPER_ADMIN' || normalized === 'SUPER ADMIN') return 'Super Admin'
    if (normalized === 'MANAGER') return 'Manager'
    if (normalized === 'USER') return 'User'

    const role = Number(value)
    if (role === 1) return 'Super Admin'
    if (role === 2) return 'Manager'
    if (role === 3) return 'User'
    return value || '-'
  }

  const resolveDeviceMeta = (device) => {
    const ownerId = Number(device.ownerUserId || device.userId || device.user_id || device.owner?.id || device.app_user?.id || 0)
    const userById = ownerId ? users.find((user) => Number(user.id) === ownerId) : null
    const owner = device.owner || device.user || device.app_user || userById || null

    const ownerName =
      device.ownerName ||
      device.owner_name ||
      owner?.fullName ||
      `${owner?.firstName || owner?.first_name || ''} ${owner?.lastName || owner?.last_name || ''}`.trim() ||
      owner?.name ||
      owner?.email ||
      '-'

    const ownerRoleRaw = device.ownerRole || device.owner_role || owner?.userRole || owner?.role || owner?.user_role

    const locationIdRaw =
      device.locationId ||
      device.location_id ||
      owner?.locationId ||
      owner?.location_id ||
      owner?.location?.id ||
      null

    const locationId = Number(locationIdRaw)
    const locationById = Number.isFinite(locationId) && locationId > 0
      ? locations.find((loc) => Number(loc.id) === locationId)
      : null

    const ownerLocation =
      locationById?.name ||
      device.locationName ||
      device.location_name ||
      owner?.locationName ||
      owner?.location?.name ||
      owner?.address ||
      '-'

    return {
      ownerName,
      ownerRole: roleLabel(ownerRoleRaw),
      ownerLocation
    }
  }

  const replyRows = useMemo(
    () =>
      (Array.isArray(replies) ? replies : []).map((item, index) => {
        const dateValue = Number(item?.date || item?.receivedAt || item?.timestamp || 0)
        return {
          key: item?.id || item?._id || `${dateValue || 'row'}-${item?.from || item?.phone || index}`,
          receivedAt: dateValue ? new Date(dateValue).toLocaleString() : 'Unknown time',
          from: item?.from || item?.phone || '-',
          message: String(item?.message || item?.text || item?.body || '-').trim() || '-'
        }
      }),
    [replies]
  )

  const renderRaw = (value) => (typeof value === 'string' ? value : JSON.stringify(value, null, 2))

  const tryParseJsonString = (value) => {
    if (typeof value !== 'string') return value
    try {
      return JSON.parse(value)
    } catch {
      return value
    }
  }

  const splitWebhookParts = (event) => {
    const parsedPayloadJson = tryParseJsonString(event?.payloadJson)

    const headers =
      event?.headers ??
      event?.requestHeaders ??
      event?.rawHeaders ??
      (parsedPayloadJson && typeof parsedPayloadJson === 'object' ? parsedPayloadJson.rawHeaders : null)

    const payload =
      event?.body ??
      event?.payload ??
      event?.rawBody ??
      (parsedPayloadJson && typeof parsedPayloadJson === 'object' ? parsedPayloadJson.rawBody : parsedPayloadJson)

    const timestamp = event?.receivedAt || event?.timestamp || event?.createdAt || event?.date || null

    return { headers, payload, timestamp, rawEvent: event }
  }

  return (
    <div className="home-shell">
      <Sidebar activeSection={activeSection} onChangeSection={setActiveSection} onLogout={onLogout} />

      <div className="dashboard-content">
        {dataStatus ? <p className="status">{dataStatus}</p> : null}
        {actionStatus.message ? <p className={actionStatus.type === 'error' ? 'status-error' : 'status-success'}>{actionStatus.message}</p> : null}

        {activeSection === 'dashboard' && (
          <>
            <h2 className="page-title">Dashboard</h2>
            <section className="metric-grid">
              {metrics.map((metric) => (
                <article key={metric.label} className="metric-card">
                  <div className="metric-icon"><AppIcon name={metric.icon} className="card-icon" /></div>
                  <div>
                    <p>{metric.label}</p>
                    <h3>{Number(metric.value || 0)}</h3>
                  </div>
                </article>
              ))}
            </section>

            <section className="dashboard-main-grid">
              <article className="device-overview card-like">
                <h3>Device Overview</h3>
                <div className="device-panel">
                  <div className="device-photo-placeholder" />
                  <dl>
                    {deviceRows.map(([label, value]) => (
                      <div className="device-row" key={label}><dt>{label}</dt><dd>{value}</dd></div>
                    ))}
                  </dl>
                </div>
              </article>

              <aside className="action-stack card-like">
                <button disabled={loading} onClick={sendConfig}><AppIcon name="command" className="btn-icon" />Send Command</button>
                <button disabled={loading} onClick={sendMessage}><AppIcon name="location" className="btn-icon" />Request Location</button>
                <button disabled={loading} onClick={fetchReplies}><AppIcon name="replies" className="btn-icon" />Fetch Replies</button>
              </aside>
            </section>
          </>
        )}

        {activeSection === 'users' && (
          <section className="card-like section-panel">
            <div className="section-head">
              <h2 className="section-title">Users</h2>
              <button className="mini-action" onClick={async () => { await Promise.all([loadLocations(), loadUsers()]); setShowUserModal(true) }}><AppIcon name="plusUser" className="btn-icon" />Create User</button>
            </div>
            <div className="table-shell">
              <table className="data-table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Contact</th><th>Location</th><th>Manager</th><th>Action</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id || u.email}>
                    <td>{`${u.firstName || ''} ${u.lastName || ''}`.trim() || u.name || '-'}</td>
                    <td>{u.email || '-'}</td>
                    <td>{u.userRole || u.role || '-'}</td>
                    <td>{u.contactNumber || '-'}</td>
                    <td>{u.locationName || u.location?.name || '-'}</td>
                    <td>{u.managerName || u.manager?.firstName || '-'}</td>
                    <td><button className="table-link" type="button" onClick={() => openEditUserModal(u)}>Edit User</button></td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </section>
        )}

        {activeSection === 'locations' && (
          <section className="card-like section-panel">
            <div className="section-head">
              <h2 className="section-title">Locations</h2>
              <button className="mini-action" onClick={() => setShowLocationModal(true)}><AppIcon name="plus" className="btn-icon" />Create Location</button>
            </div>
            <div className="table-shell">
              <table className="data-table">
              <thead><tr><th>Name</th><th>Details</th><th>User Count</th><th>Device Count</th><th>Action</th></tr></thead>
              <tbody>
                {locations.map((l) => (
                  <tr key={l.id || l.name}>
                    <td>{l.name || '-'}</td>
                    <td>{l.details || '-'}</td>
                    <td>{l.userCount || l.users?.length || 0}</td>
                    <td>{l.deviceCount || l.devices?.length || 0}</td>
                    <td><button className="table-link" type="button" onClick={() => openEditLocationModal(l)}>Edit Location</button></td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </section>
        )}

        {activeSection === 'devices' && (
          <section className="card-like section-panel">
            <div className="section-head">
              <h2 className="section-title">Devices</h2>
              <button className="mini-action" onClick={async () => { await Promise.all([loadUsers(), loadLocations()]); setShowDeviceModal(true) }}><AppIcon name="plus" className="btn-icon" />Add Device</button>
            </div>
            <div className="table-shell">
              <table className="data-table">
              <thead><tr><th>Device</th><th>Phone</th><th>Owner</th><th>Role</th><th>Location</th><th>Action</th></tr></thead>
              <tbody>
                {devices.map((d) => {
                  const deviceMeta = resolveDeviceMeta(d)
                  return (
                    <tr key={d.id || d.phoneNumber || d.name}>
                      <td>{d.name || d.deviceName || '-'}</td>
                      <td>{d.phoneNumber || '-'}</td>
                      <td>{deviceMeta.ownerName}</td>
                      <td>{deviceMeta.ownerRole}</td>
                      <td>{deviceMeta.ownerLocation}</td>
                      <td><button className="table-link" type="button" onClick={() => openDeviceSettings(d)}>Open Settings</button></td>
                    </tr>
                  )
                })}
              </tbody>
              </table>
            </div>
          </section>
        )}

        {activeSection === 'settings-basic' && (
          <section className="card-like section-panel">
            <h2 className="section-title">Settings &gt; Basic Configuration</h2>
            {selectedDevice ? <p className="status-success">Editing {selectedDevice.name || selectedDevice.deviceName}.</p> : <p className="status">Select a device from Devices list to configure.</p>}

            <article className="settings-group">
              <h3 className="block-title">Basic Configurations</h3>
              <div className="field-grid two-col">
                <div><label>IMEI</label><input value={configForm.imei} readOnly /></div>
                <div><label>Device Name / Identity</label><input value={configForm.prefixName} onChange={(event) => setConfigForm((prev) => ({ ...prev, prefixName: event.target.value }))} /></div>
                <div><label>SMS Password</label><input value={configForm.smsPassword} onChange={(event) => setConfigForm((prev) => ({ ...prev, smsPassword: event.target.value }))} /></div>
                <div><label>SMS White List</label><label className="switch-row"><input type="checkbox" checked={configForm.smsWhitelistEnabled} onChange={() => toggle('smsWhitelistEnabled')} /><span>{configForm.smsWhitelistEnabled ? 'On' : 'Off'}</span></label></div>
              </div>
            </article>

            <article className="settings-group">
              <div className="section-head">
                <h3 className="block-title">Contact Information (Max 10)</h3>
                <button
                  className="mini-action"
                  type="button"
                  onClick={() => updateContacts((contacts) => [...contacts, { name: '', phone: '', smsEnabled: true, callEnabled: true }])}
                  disabled={(configForm.contacts?.length || 1) >= 10}
                >
                  Add Contact
                </button>
              </div>
              <div className="contact-table">
                <div className="contact-head"><span>Contact</span><span>Name</span><span>Contact Number</span><span>SMS</span><span>Call</span><span>Action</span></div>
                {getContacts(configForm).map((contact, index) => (
                  <div className="contact-row" key={`contact-${index + 1}`}>
                    <span className="chip">Contact {index + 1}</span>
                    <input value={contact.name} onChange={(event) => updateContacts((contacts) => contacts.map((entry, entryIndex) => entryIndex === index ? { ...entry, name: event.target.value } : entry))} placeholder="Name" />
                    <input value={contact.phone} onChange={(event) => updateContacts((contacts) => contacts.map((entry, entryIndex) => entryIndex === index ? { ...entry, phone: event.target.value } : entry))} placeholder="Phone number" />
                    <label className="switch-row"><input type="checkbox" checked={contact.smsEnabled !== false} onChange={() => updateContacts((contacts) => contacts.map((entry, entryIndex) => entryIndex === index ? { ...entry, smsEnabled: entry.smsEnabled === false } : entry))} /><span>{contact.smsEnabled !== false ? 'On' : 'Off'}</span></label>
                    <label className="switch-row"><input type="checkbox" checked={contact.callEnabled !== false} onChange={() => updateContacts((contacts) => contacts.map((entry, entryIndex) => entryIndex === index ? { ...entry, callEnabled: entry.callEnabled === false } : entry))} /><span>{contact.callEnabled !== false ? 'On' : 'Off'}</span></label>
                    <button className="table-link" type="button" onClick={() => updateContacts((contacts) => contacts.length <= 1 ? contacts : contacts.filter((_, entryIndex) => entryIndex !== index))}>Remove</button>
                  </div>
                ))}
              </div>
            </article>
          </section>
        )}

        {activeSection === 'settings-advanced' && (
          <section className="card-like section-panel">
            <h2 className="section-title">Settings &gt; Advanced Configuration</h2>
            {selectedDevice ? <p className="status-success">Advanced settings for {selectedDevice.name || selectedDevice.deviceName}.</p> : <p className="status">Select a device from Devices list to configure advanced settings.</p>}

            <article className="settings-group"><h3 className="block-title">Advanced Configurations</h3><div className="field-grid two-col"><div><label>Wi-Fi Positioning</label><label className="switch-row"><input type="checkbox" checked={configForm.wifiEnabled === '1'} onChange={() => setConfigForm((prev) => ({ ...prev, wifiEnabled: prev.wifiEnabled === '1' ? '0' : '1' }))} /><span>{configForm.wifiEnabled === '1' ? 'On' : 'Off'}</span></label></div><div><label>Speaker Volume (0-100)</label><input value={configForm.speakerVolume} onChange={(event) => setConfigForm((prev) => ({ ...prev, speakerVolume: event.target.value }))} /></div><div><label>Continuous Tracking Interval</label><input value={configForm.continuousLocateInterval} onChange={(event) => setConfigForm((prev) => ({ ...prev, continuousLocateInterval: event.target.value }))} /></div><div><label>Continuous Tracking Duration</label><input value={configForm.continuousLocateDuration} onChange={(event) => setConfigForm((prev) => ({ ...prev, continuousLocateDuration: event.target.value }))} /></div><div><label>Timezone</label><input value={configForm.timeZone} onChange={(event) => setConfigForm((prev) => ({ ...prev, timeZone: event.target.value }))} /></div><div><label>Include Status Command</label><label className="switch-row"><input type="checkbox" checked={configForm.checkStatus} onChange={() => toggle('checkStatus')} /><span>{configForm.checkStatus ? 'On' : 'Off'}</span></label></div></div></article>

            <article className="settings-group"><h3 className="block-title">Alarm Controls</h3><div className="alarm-card"><h3>SOS Action</h3><div className="alarm-row"><label>Mode</label><select value={configForm.sosMode} onChange={(event) => setConfigForm((prev) => ({ ...prev, sosMode: event.target.value }))}><option value="1">Long Press</option><option value="2">Double Click</option></select><label>Action Time</label><input type="range" min="5" max="60" value={configForm.sosActionTime} onChange={(event) => setConfigForm((prev) => ({ ...prev, sosActionTime: event.target.value }))} /></div></div><div className="alarm-card"><h3>Fall Detection</h3><div className="alarm-row"><label>Enable</label><label className="switch-row"><input type="checkbox" checked={configForm.fallDownEnabled === '1'} onChange={() => setConfigForm((prev) => ({ ...prev, fallDownEnabled: prev.fallDownEnabled === '1' ? '0' : '1' }))} /><span>{configForm.fallDownEnabled === '1' ? 'On' : 'Off'}</span></label><label>Sensitivity</label><input type="range" min="1" max="9" value={configForm.fallDownSensitivity} onChange={(event) => setConfigForm((prev) => ({ ...prev, fallDownSensitivity: event.target.value }))} /></div></div><div className="alarm-card"><h3>Motion / No Motion</h3><div className="alarm-row"><label>Enable</label><label className="switch-row"><input type="checkbox" checked={configForm.motionEnabled === '1'} onChange={() => setConfigForm((prev) => ({ ...prev, motionEnabled: prev.motionEnabled === '1' ? '0' : '1' }))} /><span>{configForm.motionEnabled === '1' ? 'On' : 'Off'}</span></label><label>Duration</label><input value={configForm.motionDurationTime} onChange={(event) => setConfigForm((prev) => ({ ...prev, motionDurationTime: event.target.value }))} /></div></div></article>
          </section>
        )}

        {activeSection === 'location' && (
          <section className="section-panel">
            <h2 className="page-title">Location</h2>
            <article className="card-like map-panel">
              {locationResult ? (
                <>
                  <div className="map-placeholder map-embed-wrap">
                    <iframe
                      title="Device location map"
                      className="map-embed"
                      src={`https://maps.google.com/maps?q=${locationResult.latitude},${locationResult.longitude}&z=15&output=embed`}
                    />
                  </div>
                  <div className="location-meta">
                    <span className="map-chip">Lat: {locationResult.latitude} Lon: {locationResult.longitude}</span>
                    <a href={locationResult.mapUrl} target="_blank" rel="noreferrer">Open in Google Maps</a>
                  </div>
                  <pre className="preview-box">{locationResult.rawMessage}</pre>
                </>
              ) : (
                <div className="map-placeholder"><span className="map-chip">No location reply yet. Click request to send Loc.</span></div>
              )}
              <button className="mini-action request-btn" disabled={loading} onClick={requestLocationUpdate}>Request Location (Loc)</button>
              <p className="status">{status}</p>
            </article>
          </section>
        )}

        {activeSection === 'commands' && (
          <section>
            <h2 className="page-title">Command Page</h2>
            <div className="commands-layout">
              <article className="card-like"><h3>Command Input</h3><div className="field-grid"><div><label>Contact Number</label><input value={configForm.contactNumber} onChange={(event) => setConfigForm((prev) => ({ ...prev, contactNumber: event.target.value }))} /></div><div><label>SOS Action</label><input value={configForm.sosActionTime} onChange={(event) => setConfigForm((prev) => ({ ...prev, sosActionTime: event.target.value }))} /></div><div><label>Geo-fence</label><input value={configForm.geoFenceRadius} onChange={(event) => setConfigForm((prev) => ({ ...prev, geoFenceRadius: event.target.value }))} /></div></div><button className="mini-action" disabled={loading} onClick={sendConfig}>Send Command</button></article>
              <article className="card-like"><h3>Command Preview</h3><pre className="preview-box">{commandPreview || 'No command generated yet.'}</pre><button className="mini-action" disabled={loading} onClick={sendConfig}>Submit</button></article>
            </div>
            <article className="card-like gateway-panel"><h3>SMS Gateway + Test Message</h3><div className="field-grid two-col"><div><label>Gateway Base URL</label><input placeholder="https://gateway-url" value={gatewayBaseUrl} onChange={(event) => setGatewayBaseUrl(event.target.value)} /></div><div><label>Gateway Token</label><input placeholder="Authorization token" value={gatewayToken} onChange={(event) => setGatewayToken(event.target.value)} /></div><div><label>Test Phone Number</label><input value={phone} onChange={(event) => setPhone(event.target.value)} /></div><div><label>Custom Message</label><input value={message} onChange={(event) => setMessage(event.target.value)} /></div></div><button className="mini-action" disabled={loading} onClick={sendMessage}>Send Test Message</button><div className="status">{status}</div><div className="status">{configStatus}</div>{configResult ? <pre className="replies conversation-box">{JSON.stringify(configResult, null, 2)}</pre> : null}</article>
          </section>
        )}

        {activeSection === 'replies' && (
          <section className="card-like section-panel">
            <h2 className="section-title">Replies</h2>
            <div className="section-head">
              <button className="mini-action" disabled={loading} onClick={fetchReplies}>Manual Refresh</button>
              <button className="mini-action" type="button" onClick={() => setAutoFetchReplies((prev) => !prev)}>
                {autoFetchReplies ? 'Stop Auto Refresh' : 'Start Auto Refresh (5s)'}
              </button>
            </div>
            <p className="status">{autoFetchReplies ? 'Auto refresh is running every 5 seconds.' : 'Auto refresh is off.'}</p>
            <div className="table-shell replies-shell">
              <table className="data-table replies-table">
                <thead>
                  <tr><th>Received At</th><th>From</th><th>Message</th></tr>
                </thead>
                <tbody>
                  {replyRows.length ? replyRows.map((row) => (
                    <tr key={row.key}>
                      <td>{row.receivedAt}</td>
                      <td>{row.from}</td>
                      <td className="reply-message">{row.message}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={3} className="reply-empty">No replies loaded yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <details className="reply-raw-wrap">
              <summary>Raw Reply Log</summary>
              <pre className="replies conversation-box">{formattedReplies}</pre>
            </details>
          </section>
        )}

        {activeSection === 'webhooks' && (
          <section className="card-like section-panel">
            <div className="section-head">
              <h2 className="section-title">Webhook Events</h2>
              <div>
                <button className="mini-action" type="button" onClick={loadWebhookEvents}>Refresh Events</button>
                <button className="mini-action" type="button" onClick={clearWebhookEvents}>Clear Events</button>
              </div>
            </div>
            <p className="status">Live listener is active. New events appear automatically. Showing latest 3 events.</p>
            <p className="status">{webhookStatus || 'No webhook data loaded yet.'}</p>

            <div className="webhook-list">
              {webhookRaw === null ? (
                <pre className="conversation-box webhook-pre">No webhook events found.</pre>
              ) : Array.isArray(webhookRaw) ? (
                webhookRaw.map((event, index) => {
                  const parts = splitWebhookParts(event)
                  return (
                    <article className="webhook-event" key={event?.id || event?._id || `${parts.timestamp || 'event'}-${index}`}>
                      {parts.timestamp ? <h3 className="webhook-time">{String(parts.timestamp)}</h3> : null}
                      {parts.headers !== null && parts.headers !== undefined ? (
                        <>
                          <h4>Headers</h4>
                          <pre className="conversation-box webhook-pre">{renderRaw(parts.headers)}</pre>
                        </>
                      ) : null}
                      <h4>Payload</h4>
                      <pre className="conversation-box webhook-pre">{renderRaw(parts.payload ?? parts.rawEvent)}</pre>
                    </article>
                  )
                })
              ) : (
                <article className="webhook-event">
                  <h4>Payload</h4>
                  <pre className="conversation-box webhook-pre">{renderRaw(webhookRaw)}</pre>
                </article>
              )}
            </div>
          </section>
        )}
      </div>

      {showUserModal ? (
        <div className="overlay" onClick={() => setShowUserModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>Create User</h3>
            <div className="field-grid two-col">
              <input placeholder="First Name" value={userForm.firstName} onChange={(event) => setUserForm((prev) => ({ ...prev, firstName: event.target.value }))} />
              <input placeholder="Last Name" value={userForm.lastName} onChange={(event) => setUserForm((prev) => ({ ...prev, lastName: event.target.value }))} />
              <input placeholder="Email" value={userForm.email} onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))} />
              <input placeholder="Password" type="password" value={userForm.password} onChange={(event) => setUserForm((prev) => ({ ...prev, password: event.target.value }))} />
              <input placeholder="Contact Number" value={userForm.contactNumber} onChange={(event) => setUserForm((prev) => ({ ...prev, contactNumber: event.target.value }))} />
              <select value={userForm.userRole} onChange={(event) => setUserForm((prev) => ({ ...prev, userRole: Number(event.target.value) }))}><option value={3}>User</option><option value={2}>Manager</option><option value={1}>Super Admin</option></select>
              <select value={userForm.locationId} onChange={(event) => setUserForm((prev) => ({ ...prev, locationId: event.target.value }))}><option value="">Location (Optional)</option>{locations.map((location) => <option key={location.id || location.name} value={location.id || ''}>{location.name || 'Unknown location'}</option>)}</select>
              <select value={userForm.managerId} onChange={(event) => setUserForm((prev) => ({ ...prev, managerId: event.target.value }))}><option value="">Manager (Optional)</option>{managers.map((manager) => <option key={manager.id || manager.email} value={manager.id || ''}>{`${manager.firstName || ''} ${manager.lastName || ''}`.trim() || manager.email}</option>)}</select>
            </div>
            <button className="mini-action" onClick={handleCreateUser}>Create</button>
          </div>
        </div>
      ) : null}

      {showLocationModal ? (
        <div className="overlay" onClick={() => setShowLocationModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>Create Location</h3>
            <div className="field-grid">
              <input placeholder="Location Name" value={locationForm.name} onChange={(event) => setLocationForm((prev) => ({ ...prev, name: event.target.value }))} />
              <textarea rows={3} placeholder="Details" value={locationForm.details} onChange={(event) => setLocationForm((prev) => ({ ...prev, details: event.target.value }))} />
            </div>
            <button className="mini-action" onClick={handleCreateLocation}>Create</button>
          </div>
        </div>
      ) : null}



      {showEditUserModal ? (
        <div className="overlay" onClick={() => { setShowEditUserModal(false); setEditingUserId(null); setUserForm(initialUserForm) }}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>Edit User</h3>
            <div className="field-grid two-col">
              <input placeholder="First Name" value={userForm.firstName} onChange={(event) => setUserForm((prev) => ({ ...prev, firstName: event.target.value }))} />
              <input placeholder="Last Name" value={userForm.lastName} onChange={(event) => setUserForm((prev) => ({ ...prev, lastName: event.target.value }))} />
              <input placeholder="Email" value={userForm.email} onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))} />
              <input placeholder="Contact Number" value={userForm.contactNumber} onChange={(event) => setUserForm((prev) => ({ ...prev, contactNumber: event.target.value }))} />
              <input placeholder="Address" value={userForm.address} onChange={(event) => setUserForm((prev) => ({ ...prev, address: event.target.value }))} />
              <select value={userForm.userRole} onChange={(event) => setUserForm((prev) => ({ ...prev, userRole: Number(event.target.value) }))}><option value={3}>User</option><option value={2}>Manager</option><option value={1}>Super Admin</option></select>
              <select value={userForm.locationId} onChange={(event) => setUserForm((prev) => ({ ...prev, locationId: event.target.value }))}><option value="">Location (Optional)</option>{locations.map((location) => <option key={location.id || location.name} value={location.id || ''}>{location.name || 'Unknown location'}</option>)}</select>
              <select value={userForm.managerId} onChange={(event) => setUserForm((prev) => ({ ...prev, managerId: event.target.value }))}><option value="">Manager (Optional)</option>{managers.map((manager) => <option key={manager.id || manager.email} value={manager.id || ''}>{`${manager.firstName || ''} ${manager.lastName || ''}`.trim() || manager.email}</option>)}</select>
            </div>
            <button className="mini-action" onClick={handleUpdateUser}>Save User</button>
          </div>
        </div>
      ) : null}

      {showEditLocationModal ? (
        <div className="overlay" onClick={() => { setShowEditLocationModal(false); setEditingLocationId(null); setLocationForm(initialLocationForm) }}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>Edit Location</h3>
            <div className="field-grid">
              <input placeholder="Location Name" value={locationForm.name} onChange={(event) => setLocationForm((prev) => ({ ...prev, name: event.target.value }))} />
              <textarea rows={3} placeholder="Details" value={locationForm.details} onChange={(event) => setLocationForm((prev) => ({ ...prev, details: event.target.value }))} />
            </div>
            <button className="mini-action" onClick={handleUpdateLocation}>Save Location</button>
          </div>
        </div>
      ) : null}

      {showDeviceModal ? (
        <div className="overlay" onClick={() => setShowDeviceModal(false)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>Add Device</h3>
            <div className="field-grid">
              <input placeholder="Device Name" value={deviceForm.name} onChange={(event) => setDeviceForm((prev) => ({ ...prev, name: event.target.value }))} />
              <input placeholder="Phone Number" value={deviceForm.phoneNumber} onChange={(event) => setDeviceForm((prev) => ({ ...prev, phoneNumber: event.target.value }))} />
              <select value={deviceForm.ownerUserId} onChange={(event) => setDeviceForm((prev) => ({ ...prev, ownerUserId: event.target.value }))}><option value="">Select User</option>{users.map((user) => <option key={user.id || user.email} value={user.id || ''}>{`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email}</option>)}</select>
              <select value={deviceForm.locationId} onChange={(event) => setDeviceForm((prev) => ({ ...prev, locationId: event.target.value }))}><option value="">Location (Optional)</option>{locations.map((location) => <option key={location.id || location.name} value={location.id || ''}>{location.name || 'Unknown location'}</option>)}</select>
            </div>
            <button className="mini-action" onClick={handleCreateDevice}>Add Device</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
