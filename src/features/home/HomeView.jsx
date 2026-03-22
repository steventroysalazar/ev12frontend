import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from '../../components/sidebar/Sidebar'
import AppIcon from '../../components/icons/AppIcon'
import { fetchJsonWithFallback, fetchWithFallback } from '../../lib/apiClient'
import './home.css'

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
const initialDeviceForm = { name: '', phoneNumber: '', eviewVersion: '', ownerUserId: '', locationId: '', externalDeviceId: '' }
const WEBHOOK_STORAGE_KEY = 'ev12:webhook-events'

const parseStoredWebhookEvents = () => {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(WEBHOOK_STORAGE_KEY)
    if (!raw) return []

    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const persistWebhookEvents = (events) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(WEBHOOK_STORAGE_KEY, JSON.stringify(events))
}

export default function HomeView({
  user,
  onLogout,
  gatewayBaseUrl,
  gatewayToken,
  setGatewayBaseUrl,
  setGatewayToken,
  configForm,
  setConfigForm,
  setConfigBaseline,
  draftCommandPreview,
  configStatus,
  configResult,
  configQueue,
  sendConfig,
  refreshConfigQueueStatus,
  resendPendingConfig,
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
  authToken,
  alarmStateByDevice,
  alarmFeed
}) {
  const [activeSection, setActiveSection] = useState('dashboard')
  const [selectedDevice, setSelectedDevice] = useState(null)

  const [showUserModal, setShowUserModal] = useState(false)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [showDeviceModal, setShowDeviceModal] = useState(false)
  const [showEditDeviceModal, setShowEditDeviceModal] = useState(false)
  const [showEditUserModal, setShowEditUserModal] = useState(false)
  const [showEditLocationModal, setShowEditLocationModal] = useState(false)
  const [editingUserId, setEditingUserId] = useState(null)
  const [editingLocationId, setEditingLocationId] = useState(null)
  const [editingDeviceId, setEditingDeviceId] = useState(null)

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
  const [clearingWebhookEvents, setClearingWebhookEvents] = useState(false)
  const webhookFingerprintRef = useRef('')

  const roleLabel = useCallback((value) => {
    const normalized = String(value || '').trim().toUpperCase()
    if (normalized === 'SUPER_ADMIN' || normalized === 'SUPER ADMIN') return 'Super Admin'
    if (normalized === 'MANAGER') return 'Manager'
    if (normalized === 'USER') return 'User'

    const role = Number(value)
    if (role === 1) return 'Super Admin'
    if (role === 2) return 'Manager'
    if (role === 3) return 'User'
    return value || '-'
  }, [])

  const normalizedRole = String(roleLabel(user?.userRole || user?.role || user?.user_role || 3)).toLowerCase()
  const isAdminDashboard = normalizedRole === 'super admin' || normalizedRole === 'manager'

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



  const asCollection = useCallback((payload, keys = []) => {
    if (Array.isArray(payload)) return payload

    for (const key of keys) {
      if (Array.isArray(payload?.[key])) return payload[key]
    }

    if (Array.isArray(payload?.content)) return payload.content
    if (Array.isArray(payload?.data)) return payload.data
    if (Array.isArray(payload?.items)) return payload.items
    return []
  }, [])

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
    setUsers(asCollection(data, ['users']))
  }, [asCollection, fetchJson])

  const loadLocations = useCallback(async () => {
    const data = await fetchJson('/api/locations', { headers: {} })
    setLocations(asCollection(data, ['locations']))
  }, [asCollection, fetchJson])

  const loadDevices = useCallback(async () => {
    try {
      const data = await fetchJson('/api/devices', { headers: {} })
      const directDevices = asCollection(data, ['devices'])
      if (directDevices.length) {
        setDevices(directDevices)
        return
      }
    } catch {
      // Fallback below via users endpoint.
    }

    const data = await fetchJson('/api/users', { headers: {} })
    const usersList = asCollection(data, ['users'])
    const flattened = usersList.flatMap((user) =>
      Array.isArray(user.devices) ? user.devices.map((device) => ({ ...device, owner: user })) : []
    )
    setDevices(flattened)
  }, [asCollection, fetchJson])

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
    const incomingEvents = Array.isArray(payload) ? payload : [payload]
    const previousEvents = parseStoredWebhookEvents()
    const mergedEvents = [...incomingEvents, ...previousEvents]
      .sort((a, b) => getEventTime(b) - getEventTime(a))
      .filter((event, index, all) => {
        const key = JSON.stringify(event)
        return all.findIndex((candidate) => JSON.stringify(candidate) === key) === index
      })

    persistWebhookEvents(mergedEvents)

    const nextFingerprint = JSON.stringify(mergedEvents)
    const hadPrevious = webhookFingerprintRef.current !== ''
    const hasNewEvent = hadPrevious && webhookFingerprintRef.current !== nextFingerprint

    webhookFingerprintRef.current = nextFingerprint
    setWebhookRaw(mergedEvents)
    setWebhookStatus(hasNewEvent
      ? `New webhook event received. Showing ${mergedEvents.length} saved webhook event(s).`
      : (mergedEvents.length
        ? `Showing ${mergedEvents.length} saved webhook event(s).`
        : 'No webhook events fetched yet.'))
  }, [authToken])

  useEffect(() => {
    const storedEvents = parseStoredWebhookEvents()
    if (!storedEvents.length) return

    webhookFingerprintRef.current = JSON.stringify(storedEvents)
    setWebhookRaw(storedEvents)
    setWebhookStatus(`Loaded ${storedEvents.length} webhook event(s) from local storage.`)
  }, [])

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

  const clearWebhookEvents = useCallback(async () => {
    if (clearingWebhookEvents) return

    setClearingWebhookEvents(true)
    setWebhookStatus('Clearing webhook events...')

    const endpoints = ['/api/webhooks/ev12/events', 'http://localhost:8090/api/webhooks/ev12/events']
    let deletedCount = 0
    let lastError = null

    try {
      for (const endpoint of endpoints) {
        try {
          const { response } = await fetchWithFallback(endpoint, {
            method: 'DELETE',
            headers: {
              ...(authToken ? { Authorization: authToken } : {}),
              ...(gatewayToken ? { 'X-Webhook-Token': gatewayToken } : {})
            }
          })

          const body = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(body.error || body.message || `Failed ${endpoint}`)

          deletedCount = Number(body.deleted) || 0
          webhookFingerprintRef.current = ''
          persistWebhookEvents([])
          setWebhookRaw([])
          setWebhookStatus(`Webhook events cleared. Deleted ${deletedCount} event(s).`)
          return
        } catch (error) {
          lastError = error
        }
      }

      setWebhookStatus(`Unable to clear webhook events: ${lastError?.message || 'Unknown error'}`)
    } finally {
      setClearingWebhookEvents(false)
    }
  }, [authToken, gatewayToken, clearingWebhookEvents])

  const formatWebhookLabel = useCallback((value) => {
    if (!value) return 'Unknown event'
    return String(value)
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b\w/g, (char) => char.toUpperCase())
  }, [])

  const webhookSummary = useCallback((event, index) => {
    const parts = splitWebhookParts(event)
    const eventType =
      event?.event ||
      event?.eventType ||
      event?.type ||
      event?.payload?.event ||
      event?.payload?.type ||
      event?.rawEvent?.event ||
      event?.rawEvent?.type

    const source =
      event?.source ||
      event?.provider ||
      event?.payload?.source ||
      event?.rawEvent?.source ||
      event?.headers?.['x-forwarded-host'] ||
      event?.headers?.host

    const phoneValue =
      event?.phone ||
      event?.msisdn ||
      event?.payload?.phone ||
      event?.payload?.msisdn ||
      event?.rawEvent?.phone ||
      event?.rawEvent?.msisdn ||
      event?.payload?.contact?.phone

    return {
      parts,
      title: formatWebhookLabel(eventType),
      source: source || 'EV12 Webhook',
      phone: phoneValue || null,
      id: event?.id || event?._id || event?.messageId || event?.payload?.messageId || `event-${index + 1}`
    }
  }, [formatWebhookLabel])

  const openDeviceSettings = async (device) => {
    const selectedDeviceId = Number(device?.id || device?.deviceId)
    let resolvedDevice = device

    if (Number.isInteger(selectedDeviceId) && selectedDeviceId > 0) {
      setActionStatus({ type: 'info', message: 'Loading latest device configuration...' })
      try {
        resolvedDevice = await fetchJson(`/api/devices/${selectedDeviceId}`, { headers: {} })
      } catch (error) {
        setActionStatus({ type: 'error', message: `Could not refresh device data, using cached row values: ${error.message}` })
      }
    }

    const protocolSettings = resolvedDevice?.protocolSettings && typeof resolvedDevice.protocolSettings === 'object'
      ? resolvedDevice.protocolSettings
      : {}

    setSelectedDevice(resolvedDevice)
    const seededContacts = Array.isArray(protocolSettings.contacts) && protocolSettings.contacts.length
      ? protocolSettings.contacts.slice(0, 10)
      : [...getContacts(configForm)]

    const primaryName = resolvedDevice.ownerName || resolvedDevice.owner?.firstName || protocolSettings.contactName || seededContacts[0]?.name || configForm.contactName
    const primaryPhone = resolvedDevice.phoneNumber || protocolSettings.contactNumber || seededContacts[0]?.phone || configForm.contactNumber

    seededContacts[0] = {
      slot: 1,
      name: primaryName || '',
      phone: primaryPhone || '',
      smsEnabled: seededContacts[0]?.smsEnabled !== false,
      callEnabled: seededContacts[0]?.callEnabled !== false
    }

    const nextConfigForm = {
      ...configForm,
      ...protocolSettings,
      deviceId: resolvedDevice.id || resolvedDevice.deviceId || configForm.deviceId,
      imei: resolvedDevice.imei || protocolSettings.imei || configForm.imei,
      prefixName: resolvedDevice.name || resolvedDevice.deviceName || protocolSettings.prefixName || configForm.prefixName,
      contacts: seededContacts.slice(0, 10),
      contactSlot: protocolSettings.contactSlot || 1,
      contactNumber: primaryPhone || '',
      contactName: primaryName || ''
    }

    setConfigForm(nextConfigForm)
    setConfigBaseline(nextConfigForm)
    setActionStatus({ type: 'success', message: `Opened settings for ${resolvedDevice.name || resolvedDevice.deviceName || 'device'}.` })
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
      if (!deviceForm.eviewVersion.trim()) throw new Error('Device version is required')

      const payload = {
        name: deviceForm.name.trim(),
        phoneNumber: deviceForm.phoneNumber.trim(),
        eviewVersion: deviceForm.eviewVersion.trim(),
        version: deviceForm.eviewVersion.trim(),
        locationId: deviceForm.locationId ? Number(deviceForm.locationId) : null,
        ownerUserId: Number(deviceForm.ownerUserId),
        ...(deviceForm.externalDeviceId.trim()
          ? { externalDeviceId: deviceForm.externalDeviceId.trim(), deviceId: deviceForm.externalDeviceId.trim() }
          : {})
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

  const openEditDeviceModal = async (device) => {
    await Promise.all([loadUsers(), loadLocations()])

    setEditingDeviceId(device.id || device.deviceId)
    setDeviceForm({
      name: device.name || device.deviceName || '',
      phoneNumber: device.phoneNumber || '',
      eviewVersion: device.eviewVersion || device.version || '',
      ownerUserId: device.ownerUserId || device.userId || device.user_id || device.owner?.id || device.app_user?.id || '',
      locationId: device.locationId || device.location_id || '',
      externalDeviceId: device.externalDeviceId || device.external_device_id || device.deviceId || ''
    })
    setShowEditDeviceModal(true)
  }

  const handleUpdateDevice = async () => {
    try {
      if (!editingDeviceId) throw new Error('Device id is missing')
      if (!deviceForm.name.trim() || !deviceForm.phoneNumber.trim()) throw new Error('Device name and phone number are required')

      const payload = {
        name: deviceForm.name.trim(),
        phoneNumber: deviceForm.phoneNumber.trim(),
        eviewVersion: deviceForm.eviewVersion.trim(),
        version: deviceForm.eviewVersion.trim(),
        userId: deviceForm.ownerUserId ? Number(deviceForm.ownerUserId) : null,
        locationId: deviceForm.locationId ? Number(deviceForm.locationId) : null,
        externalDeviceId: deviceForm.externalDeviceId.trim() || null,
        deviceId: deviceForm.externalDeviceId.trim() || null
      }

      try {
        await fetchJson(`/api/devices/${editingDeviceId}`, { method: 'PUT', body: JSON.stringify(payload) })
      } catch {
        await fetchJson(`/api/devices/${editingDeviceId}`, { method: 'PATCH', body: JSON.stringify(payload) })
      }

      setActionStatus({ type: 'success', message: 'Device updated successfully.' })
      setShowEditDeviceModal(false)
      setEditingDeviceId(null)
      setDeviceForm(initialDeviceForm)
      await loadDevices()
    } catch (error) {
      setActionStatus({ type: 'error', message: `Update device failed: ${error.message}` })
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

  const managers = users.filter((nextUser) => Number(nextUser.userRole) === 2)

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

  const userDeviceRows = useMemo(() => {
    const currentUserId = Number(user?.id || user?.userId || user?.user_id || 0)
    const ownedDevices = devices.filter((device) => {
      const ownerId = Number(device.ownerUserId || device.userId || device.user_id || device.owner?.id || device.app_user?.id || 0)
      return currentUserId > 0 && ownerId === currentUserId
    })

    const currentDevice = ownedDevices[0] || devices[0]
    if (!currentDevice) return []

    const deviceMeta = resolveDeviceMeta(currentDevice)
    return [
      ['Device Name', currentDevice.name || currentDevice.deviceName || '-'],
      ['Device Phone Number', currentDevice.phoneNumber || '-'],
      ['Alarm Status', resolveLiveAlarmCode(currentDevice) || 'No active alarm'],
      ['Owner User', deviceMeta.ownerName],
      ['Owner Location', deviceMeta.ownerLocation],
      ['Last reply', replyRows[0]?.receivedAt || 'No reply yet'],
      ['Battery status', currentDevice.batteryStatus || currentDevice.battery || 'Unknown']
    ]
  }, [devices, replyRows, user, resolveDeviceMeta, resolveLiveAlarmCode])

  const getAlarmMeta = useCallback((alarmCode) => {
    const normalizedCode = String(alarmCode || '').trim()
    if (!normalizedCode) return { label: 'No active alarm', tone: 'idle' }

    const normalizedLower = normalizedCode.toLowerCase()
    if (normalizedLower.includes('sos')) return { label: 'SOS Alert', tone: 'critical' }
    if (normalizedLower.includes('fall')) return { label: 'Fall-Down Alert', tone: 'warning' }

    return { label: normalizedCode, tone: 'active' }
  }, [])

  const resolveLiveAlarmCode = useCallback(
    (device) => {
      const deviceId = Number(device?.id || device?.deviceId || 0)
      const externalDeviceId = String(device?.externalDeviceId || device?.external_device_id || '').trim()
      const liveEntry =
        (deviceId ? alarmStateByDevice?.[`id:${deviceId}`] : null) ||
        (externalDeviceId ? alarmStateByDevice?.[`ext:${externalDeviceId}`] : null)

      if (!liveEntry) return device?.alarmCode ?? null
      if (liveEntry.alarmCode === null) return null
      return liveEntry.alarmCode || device?.alarmCode || null
    },
    [alarmStateByDevice]
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


  const queueStatusLabel = String(configQueue?.status || 'IDLE').toUpperCase()
  const isQueuePending = Boolean(configQueue?.pending || queueStatusLabel === 'PENDING')
  const nextResendAtMs = configQueue?.nextResendAt ? new Date(configQueue.nextResendAt).getTime() : null
  const nowMs = Date.now()
  const resendRemainingMs = nextResendAtMs ? Math.max(nextResendAtMs - nowMs, 0) : 0
  const resendCooldownActive = isQueuePending && Boolean(nextResendAtMs) && resendRemainingMs > 0
  const resendRemainingText = resendCooldownActive
    ? `${Math.ceil(resendRemainingMs / 1000)}s`
    : 'Ready now'
  const queuedCommandPreview = (configQueue?.commandPreview || '').trim()
  const activeCommandPreview = (draftCommandPreview || '').trim()
  const hasActiveCommand = Boolean(activeCommandPreview)
  const hasQueuedCommand = Boolean(queuedCommandPreview)
  const hasCommandChanges = hasActiveCommand && activeCommandPreview !== queuedCommandPreview

  return (
    <div className="home-shell">
      <Sidebar activeSection={activeSection} onChangeSection={setActiveSection} onLogout={onLogout} />

      <div className="dashboard-content">
        {dataStatus ? <p className="status">{dataStatus}</p> : null}
        {actionStatus.message ? <p className={actionStatus.type === 'error' ? 'status-error' : 'status-success'}>{actionStatus.message}</p> : null}

        {activeSection === 'dashboard' && (
          <>
            <h2 className="page-title">{isAdminDashboard ? 'Admin Dashboard' : 'My Device Dashboard'}</h2>
            <section className="live-alarm-strip">
              <div>
                <strong>Live alarm feed</strong>
                <p>{alarmFeed.length ? 'Receiving global alarm updates in real time.' : 'Waiting for incoming alarm updates...'}</p>
              </div>
              <div className="live-alarm-list">
                {alarmFeed.slice(0, 3).map((entry, index) => {
                  const alarmMeta = getAlarmMeta(entry?.alarmCode)
                  return (
                    <span key={`${entry?.updatedAt || 'alarm'}-${entry?.deviceId || 'device'}-${index}`} className={`alarm-pill alarm-pill-${alarmMeta.tone}`}>
                      #{entry?.deviceId || entry?.externalDeviceId || '-'} · {alarmMeta.label}
                    </span>
                  )
                })}
              </div>
            </section>

            {isAdminDashboard ? (
              <>
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
                    <h3>Recently Added Devices</h3>
                    <div className="table-shell dashboard-device-table">
                      <table className="data-table">
                        <thead><tr><th>Device</th><th>Alarm</th><th>Owner</th><th>Role</th><th>Location</th></tr></thead>
                        <tbody>
                          {devices.slice(0, 5).map((device) => {
                            const meta = resolveDeviceMeta(device)
                            const alarmMeta = getAlarmMeta(resolveLiveAlarmCode(device))
                            return (
                              <tr key={device.id || device.phoneNumber || device.name}>
                                <td>{device.name || device.deviceName || '-'}</td>
                                <td><span className={`alarm-pill alarm-pill-${alarmMeta.tone}`}>{alarmMeta.label}</span></td>
                                <td>{meta.ownerName}</td>
                                <td>{meta.ownerRole}</td>
                                <td>{meta.ownerLocation}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </article>

                  <aside className="action-stack card-like">
                    <button disabled={loading} onClick={sendConfig}><AppIcon name="command" className="btn-icon" />Send Command</button>
                    <button disabled={loading} onClick={sendMessage}><AppIcon name="location" className="btn-icon" />Request Location</button>
                    <button disabled={loading} onClick={fetchReplies}><AppIcon name="replies" className="btn-icon" />Fetch Replies</button>
                  </aside>
                </section>
              </>
            ) : (
              <section className="dashboard-main-grid user-dashboard-grid">
                <article className="device-overview card-like">
                  <h3>My Assigned Device</h3>
                  <div className="device-panel">
                    <div className="device-photo-placeholder" />
                    <dl>
                      {(userDeviceRows.length ? userDeviceRows : [['Status', 'No assigned device found yet.']]).map(([label, value]) => (
                        <div className="device-row" key={label}><dt>{label}</dt><dd>{value}</dd></div>
                      ))}
                    </dl>
                  </div>
                </article>
              </section>
            )}
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
              <thead><tr><th>Device</th><th>Phone</th><th>Version</th><th>Webhook Device ID</th><th>Alarm</th><th>Owner</th><th>Role</th><th>Location</th><th>Action</th></tr></thead>
              <tbody>
                {devices.map((d) => {
                  const deviceMeta = resolveDeviceMeta(d)
                  const alarmMeta = getAlarmMeta(resolveLiveAlarmCode(d))
                  return (
                    <tr key={d.id || d.phoneNumber || d.name}>
                      <td>{d.name || d.deviceName || '-'}</td>
                      <td>{d.phoneNumber || '-'}</td>
                      <td>{d.eviewVersion || d.version || '-'}</td>
                      <td>{d.externalDeviceId || d.external_device_id || d.deviceId || '-'}</td>
                      <td><span className={`alarm-pill alarm-pill-${alarmMeta.tone}`}>{alarmMeta.label}</span></td>
                      <td>{deviceMeta.ownerName}</td>
                      <td>{deviceMeta.ownerRole}</td>
                      <td>{deviceMeta.ownerLocation}</td>
                      <td>
                        <button className="table-link" type="button" onClick={() => openEditDeviceModal(d)}>Edit</button>
                        <button className="table-link" type="button" onClick={() => openDeviceSettings(d)}>Open Settings</button>
                      </td>
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

            <article className="settings-group">
              <h3 className="block-title">Advanced Configurations</h3>
              <div className="field-grid two-col">
                <div>
                  <label>Wi-Fi Positioning</label>
                  <label className="switch-row">
                    <input type="checkbox" checked={configForm.wifiEnabled === '1'} onChange={() => setConfigForm((prev) => ({ ...prev, wifiEnabled: prev.wifiEnabled === '1' ? '0' : '1' }))} />
                    <span>{configForm.wifiEnabled === '1' ? 'On' : 'Off'}</span>
                  </label>
                </div>
                <div>
                  <label>Speaker Volume (0-100)</label>
                  <div className="range-with-value">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={configForm.speakerVolume}
                      onChange={(event) => setConfigForm((prev) => ({ ...prev, speakerVolume: event.target.value }))}
                    />
                    <span className="range-value">{configForm.speakerVolume}</span>
                  </div>
                </div>
                <div><label>Continuous Tracking Interval</label><input value={configForm.continuousLocateInterval} onChange={(event) => setConfigForm((prev) => ({ ...prev, continuousLocateInterval: event.target.value }))} /></div>
                <div><label>Continuous Tracking Duration</label><input value={configForm.continuousLocateDuration} onChange={(event) => setConfigForm((prev) => ({ ...prev, continuousLocateDuration: event.target.value }))} /></div>
                <div><label>Timezone</label><input value={configForm.timeZone} onChange={(event) => setConfigForm((prev) => ({ ...prev, timeZone: event.target.value }))} /></div>
                <div><label>Include Status Command</label><label className="switch-row"><input type="checkbox" checked={configForm.checkStatus} onChange={() => toggle('checkStatus')} /><span>{configForm.checkStatus ? 'On' : 'Off'}</span></label></div>
              </div>
            </article>

            <article className="settings-group">
              <h3 className="block-title">Alarm Controls</h3>
              <div className="alarm-card">
                <h3>SOS Action</h3>
                <div className="alarm-row">
                  <label>Mode</label>
                  <select value={configForm.sosMode} onChange={(event) => setConfigForm((prev) => ({ ...prev, sosMode: event.target.value }))}><option value="1">Long Press</option><option value="2">Double Click</option></select>
                  <label>Action Time</label>
                  <div className="range-with-value">
                    <input type="range" min="5" max="60" value={configForm.sosActionTime} onChange={(event) => setConfigForm((prev) => ({ ...prev, sosActionTime: event.target.value }))} />
                    <span className="range-value">{configForm.sosActionTime}</span>
                  </div>
                </div>
              </div>
              <div className="alarm-card">
                <h3>Fall Detection</h3>
                <div className="alarm-row">
                  <label>Enable</label>
                  <label className="switch-row"><input type="checkbox" checked={configForm.fallDownEnabled === '1'} onChange={() => setConfigForm((prev) => ({ ...prev, fallDownEnabled: prev.fallDownEnabled === '1' ? '0' : '1' }))} /><span>{configForm.fallDownEnabled === '1' ? 'On' : 'Off'}</span></label>
                  <label>Sensitivity</label>
                  <div className="range-with-value">
                    <input type="range" min="1" max="9" value={configForm.fallDownSensitivity} onChange={(event) => setConfigForm((prev) => ({ ...prev, fallDownSensitivity: event.target.value }))} />
                    <span className="range-value">{configForm.fallDownSensitivity}</span>
                  </div>
                </div>
              </div>
              <div className="alarm-card"><h3>Motion / No Motion</h3><div className="alarm-row"><label>Enable</label><label className="switch-row"><input type="checkbox" checked={configForm.motionEnabled === '1'} onChange={() => setConfigForm((prev) => ({ ...prev, motionEnabled: prev.motionEnabled === '1' ? '0' : '1' }))} /><span>{configForm.motionEnabled === '1' ? 'On' : 'Off'}</span></label><label>Duration</label><input value={configForm.motionDurationTime} onChange={(event) => setConfigForm((prev) => ({ ...prev, motionDurationTime: event.target.value }))} /></div></div>
            </article>
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
              <article className="card-like queue-card">
                <h3>Command Queue</h3>
                <div className="queue-grid">
                  <p><strong>Status:</strong> <span className={`queue-chip queue-${queueStatusLabel.toLowerCase()}`}>{queueStatusLabel}</span></p>
                  <p><strong>Last Sent:</strong> {configQueue?.lastSentAt ? new Date(configQueue.lastSentAt).toLocaleString() : '-'}</p>
                  <p><strong>Applied:</strong> {configQueue?.appliedAt ? new Date(configQueue.appliedAt).toLocaleString() : 'Not confirmed yet'}</p>
                  <p><strong>Next Resend:</strong> {configQueue?.nextResendAt ? new Date(configQueue.nextResendAt).toLocaleString() : '-'}</p>
                  <p><strong>Cooldown:</strong> {resendRemainingText}</p>
                </div>
                <div className="queue-actions">
                  <button className="mini-action" disabled={loading || !configForm.deviceId} onClick={() => refreshConfigQueueStatus(configForm.deviceId)}>Refresh Queue</button>
                  <button
                    className="mini-action"
                    disabled={loading || !isQueuePending || resendCooldownActive}
                    onClick={resendPendingConfig}
                    title={!isQueuePending ? 'Resend is available only while status is PENDING.' : resendCooldownActive ? 'Resend cooldown is active for 5 minutes after send.' : 'Resend pending SMS command'}
                  >
                    {resendCooldownActive ? `Resend in ${resendRemainingText}` : 'Resend SMS Command'}
                  </button>
                </div>
                <div className="queue-previews-grid">
                  <section className="queue-preview-panel">
                    <div className="queue-preview-head">
                      <h4>Queued Command</h4>
                      <span className={`queue-mini-chip ${hasQueuedCommand ? 'queue-mini-ready' : 'queue-mini-empty'}`}>
                        {hasQueuedCommand ? 'In Queue' : 'Empty'}
                      </span>
                    </div>
                    <pre className="preview-box queue-preview">{queuedCommandPreview || 'No command queued yet.'}</pre>
                  </section>

                  <section className="queue-preview-panel">
                    <div className="queue-preview-head">
                      <h4>Active Draft (Updates Only)</h4>
                      <span className={`queue-mini-chip ${hasCommandChanges ? 'queue-mini-changed' : 'queue-mini-empty'}`}>
                        {hasCommandChanges ? 'Pending Updates' : 'No Updates'}
                      </span>
                    </div>
                    <pre className="preview-box queue-preview">{activeCommandPreview || 'No draft updates. Only changed values are shown here.'}</pre>
                  </section>
                </div>
              </article>
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
                <button className="mini-action" type="button" onClick={clearWebhookEvents} disabled={clearingWebhookEvents}>
                  {clearingWebhookEvents ? 'Clearing…' : 'Clear Events'}
                </button>
              </div>
            </div>
            <p className="status">Live listener is active. New events appear automatically. Showing all fetched events.</p>
            <p className="status">{webhookStatus || 'No webhook data loaded yet.'}</p>

            <div className="webhook-list">
              {webhookRaw === null ? (
                <pre className="conversation-box webhook-pre">No webhook events found.</pre>
              ) : Array.isArray(webhookRaw) ? (
                webhookRaw.map((event, index) => {
                  const summary = webhookSummary(event, index)
                  const { parts } = summary
                  return (
                    <article className="webhook-event" key={event?.id || event?._id || `${parts.timestamp || 'event'}-${index}`}>
                      <header className="webhook-head">
                        <h3 className="webhook-title">{summary.title}</h3>
                        <div className="webhook-meta-row">
                          <span className="webhook-chip">ID: {summary.id}</span>
                          <span className="webhook-chip">Source: {summary.source}</span>
                          {summary.phone ? <span className="webhook-chip">Phone: {summary.phone}</span> : null}
                        </div>
                        {parts.timestamp ? <p className="webhook-time">{String(parts.timestamp)}</p> : null}
                      </header>
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
              <input placeholder="Device Version" value={deviceForm.eviewVersion} onChange={(event) => setDeviceForm((prev) => ({ ...prev, eviewVersion: event.target.value }))} />
              <input placeholder="Webhook Device ID (externalDeviceId)" value={deviceForm.externalDeviceId} onChange={(event) => setDeviceForm((prev) => ({ ...prev, externalDeviceId: event.target.value }))} />
              <select value={deviceForm.ownerUserId} onChange={(event) => setDeviceForm((prev) => ({ ...prev, ownerUserId: event.target.value }))}><option value="">Select User</option>{users.map((user) => <option key={user.id || user.email} value={user.id || ''}>{`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email}</option>)}</select>
              <select value={deviceForm.locationId} onChange={(event) => setDeviceForm((prev) => ({ ...prev, locationId: event.target.value }))}><option value="">Location (Optional)</option>{locations.map((location) => <option key={location.id || location.name} value={location.id || ''}>{location.name || 'Unknown location'}</option>)}</select>
            </div>
            <button className="mini-action" onClick={handleCreateDevice}>Add Device</button>
          </div>
        </div>
      ) : null}

      {showEditDeviceModal ? (
        <div className="overlay" onClick={() => { setShowEditDeviceModal(false); setEditingDeviceId(null); setDeviceForm(initialDeviceForm) }}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h3>Edit Device</h3>
            <div className="field-grid">
              <input placeholder="Device Name" value={deviceForm.name} onChange={(event) => setDeviceForm((prev) => ({ ...prev, name: event.target.value }))} />
              <input placeholder="Phone Number" value={deviceForm.phoneNumber} onChange={(event) => setDeviceForm((prev) => ({ ...prev, phoneNumber: event.target.value }))} />
              <input placeholder="Device Version" value={deviceForm.eviewVersion} onChange={(event) => setDeviceForm((prev) => ({ ...prev, eviewVersion: event.target.value }))} />
              <input placeholder="Webhook Device ID (externalDeviceId)" value={deviceForm.externalDeviceId} onChange={(event) => setDeviceForm((prev) => ({ ...prev, externalDeviceId: event.target.value }))} />
              <select value={deviceForm.ownerUserId} onChange={(event) => setDeviceForm((prev) => ({ ...prev, ownerUserId: event.target.value }))}><option value="">Select User</option>{users.map((user) => <option key={user.id || user.email} value={user.id || ''}>{`${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email}</option>)}</select>
              <select value={deviceForm.locationId} onChange={(event) => setDeviceForm((prev) => ({ ...prev, locationId: event.target.value }))}><option value="">Location (Optional)</option>{locations.map((location) => <option key={location.id || location.name} value={location.id || ''}>{location.name || 'Unknown location'}</option>)}</select>
            </div>
            <button className="mini-action" onClick={handleUpdateDevice}>Save Device</button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
