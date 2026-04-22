import { Suspense, lazy, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import Navbar from './components/navbar/Navbar'
import { buildEv12Preview, formatReply, initialConfigForm } from './features/home/ev12'
import { buildEviewSmsAccessSetup } from './features/home/smsAccessSetup'
import { fetchWithFallback } from './lib/apiClient'
import { startAlarmStream } from './lib/alarmStream'
import { authReducer, initialAuthState, loadPersistedAuth, persistAuth } from './store/authStore'
import './App.css'

const initialRegisterForm = {
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

const initialLoginForm = { email: '', password: '' }
const ALARM_CANCELLED_STORAGE_KEY = 'ev12:alarm-cancelled-at'

const HomeView = lazy(() => import('./features/home/HomeView'))
const LoginView = lazy(() => import('./features/login/LoginView'))
const RegisterView = lazy(() => import('./features/register/RegisterView'))


const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const extractLocationFromText = (text) => {
  if (!text) return null

  const mapMatch = text.match(/https?:\/\/(?:www\.)?google\.com\/maps\?q=\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i)
  const genericMapMatch = text.match(/maps\?q=\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i)
  const coordMatch = text.match(/(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/)

  const match = mapMatch || genericMapMatch || coordMatch
  if (!match) return null

  const latitude = Number.parseFloat(match[1])
  const longitude = Number.parseFloat(match[2])

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null

  return {
    latitude,
    longitude,
    mapUrl: `https://www.google.com/maps?q=${latitude},${longitude}`
  }
}

const extractLocationFromWebhookPayload = (payload) => {
  if (!payload || typeof payload !== 'object') return null

  const gpsNode =
    payload?.data?.['GPS Location'] ||
    payload?.data?.gpsLocation ||
    payload?.gpsLocation ||
    payload?.location ||
    payload?.payload?.data?.['GPS Location'] ||
    payload?.payload?.gpsLocation ||
    payload?.rawEvent?.data?.['GPS Location'] ||
    payload?.rawEvent?.gpsLocation

  const latitude = Number.parseFloat(
    gpsNode?.latitude ?? gpsNode?.lat ?? payload?.latitude ?? payload?.lat
  )
  const longitude = Number.parseFloat(
    gpsNode?.longitude ?? gpsNode?.lng ?? payload?.longitude ?? payload?.lng
  )

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null

  return {
    latitude,
    longitude,
    mapUrl: `https://www.google.com/maps?q=${latitude},${longitude}`,
    rawMessage: JSON.stringify(payload, null, 2),
    source: 'webhook'
  }
}

const replyText = (reply) => String(reply?.message || reply?.text || reply?.body || '')

const normalizeWebhookAlarmCode = (value) => {
  if (value === null || value === undefined) return null

  if (Array.isArray(value)) {
    if (!value.length) return null
    const flattened = value
      .flatMap((entry) => {
        if (entry === null || entry === undefined) return []
        if (Array.isArray(entry)) return entry
        if (typeof entry === 'object') {
          return [
            entry?.code,
            entry?.eventCode,
            entry?.alarmCode,
            entry?.alertCode,
            entry?.name,
            entry?.label,
            entry?.type
          ].filter(Boolean)
        }
        return [entry]
      })
      .map((entry) => String(entry).trim())
      .filter(Boolean)

    if (!flattened.length) return null
    const sosMatch = flattened.find((entry) => /sos/i.test(entry))
    if (sosMatch) return 'SOS Alert'
    const fallMatch = flattened.find((entry) => /fall/i.test(entry))
    if (fallMatch) return 'Fall-Down Alert'
    return flattened[0]
  }

  const code = String(value).trim()
  if (!code) return null

  if (/sos/i.test(code)) return 'SOS Alert'
  if (/fall/i.test(code)) return 'Fall-Down Alert'
  return code
}

const normalizeAlarmUpdatePayload = (update) => {
  if (!update || typeof update !== 'object') return null

  const deviceId = Number(
    update?.deviceId ||
    update?.internalDeviceId ||
    update?.internal_device_id ||
    update?.id ||
    0
  )

  const externalDeviceId = String(
    update?.externalDeviceId ||
    update?.external_device_id ||
    update?.deviceExternalId ||
    update?.device_external_id ||
    update?.imei ||
    ''
  ).trim()

  if (!deviceId && !externalDeviceId) return null

  return {
    ...update,
    deviceId: deviceId || undefined,
    externalDeviceId: externalDeviceId || undefined,
    alarmCode:
      update?.alarmCode ??
      update?.alarm_code ??
      update?.alertCode ??
      update?.alert_code ??
      null,
    alarmTriggeredAt:
      update?.alarmTriggeredAt ??
      update?.alarm_triggered_at ??
      null,
    alarmCancelledAt:
      update?.alarmCancelledAt ??
      update?.alarm_cancelled_at ??
      null,
    updatedAt:
      update?.updatedAt ||
      update?.updated_at ||
      update?.receivedAt ||
      update?.received_at ||
      update?.timestamp ||
      new Date().toISOString()
  }
}

const pickChangedFields = (current = {}, baseline = null) => {
  if (!baseline || typeof baseline !== 'object') return { ...current }

  return Object.entries(current).reduce((accumulator, [key, value]) => {
    if (JSON.stringify(value) !== JSON.stringify(baseline[key])) {
      accumulator[key] = value
    }
    return accumulator
  }, {})
}

export default function App() {
  const [auth, dispatchAuth] = useReducer(authReducer, initialAuthState, loadPersistedAuth)
  const [activeView, setActiveView] = useState(() => {
    if (typeof window === 'undefined') return auth.isAuthenticated ? 'home' : 'login'
    const path = window.location.pathname.toLowerCase()
    if (path === '/register') return 'register'
    if (path === '/login') return 'login'
    return auth.isAuthenticated ? 'home' : 'login'
  })
  const [authStatus, setAuthStatus] = useState(auth.isAuthenticated ? 'Authenticated session restored.' : 'Enter your credentials to sign in.')
  const [authLoading, setAuthLoading] = useState(false)

  const [registerForm, setRegisterForm] = useState(initialRegisterForm)
  const [loginForm, setLoginForm] = useState(initialLoginForm)

  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [lastSentPhone, setLastSentPhone] = useState('')
  const [lastSeenTimestamp, setLastSeenTimestamp] = useState(0)
  const [status, setStatus] = useState('Ready.')
  const [gatewayBaseUrl, setGatewayBaseUrl] = useState('')
  const [gatewayToken, setGatewayToken] = useState('')
  const [replies, setReplies] = useState([])
  const [loading, setLoading] = useState(false)
  const [configStatus, setConfigStatus] = useState('')
  const [configResult, setConfigResult] = useState(null)
  const [configQueue, setConfigQueue] = useState(null)
  const [configForm, setConfigForm] = useState(initialConfigForm)
  const [configBaseline, setConfigBaseline] = useState(() => ({ ...initialConfigForm }))
  const [locationResult, setLocationResult] = useState(null)
  const [alarmStateByDevice, setAlarmStateByDevice] = useState({})
  const [alarmFeed, setAlarmFeed] = useState([])
  const [alarmStreamConnected, setAlarmStreamConnected] = useState(false)
  const [homeActiveSection, setHomeActiveSection] = useState('dashboard')
  const [alarmCancelledAtByDevice, setAlarmCancelledAtByDevice] = useState({})
  const alarmCancelledAtRef = useRef({})
  const queuedCommandByDeviceRef = useRef({})

  const updateUrlForView = useCallback((view, { replace = false } = {}) => {
    if (typeof window === 'undefined') return

    const normalizedView = view === 'register' || view === 'login' ? view : 'home'
    const nextPath = normalizedView === 'home' ? '/' : `/${normalizedView}`
    const nextSearch = normalizedView === 'home' ? window.location.search : ''
    const nextUrl = `${nextPath}${nextSearch}`
    const currentUrl = `${window.location.pathname}${window.location.search}`

    if (currentUrl === nextUrl) return

    if (replace) {
      window.history.replaceState({}, '', nextUrl)
      return
    }

    window.history.pushState({}, '', nextUrl)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const syncViewFromUrl = () => {
      const path = window.location.pathname.toLowerCase()
      if (path === '/register') {
        setActiveView('register')
        return
      }
      if (path === '/login') {
        setActiveView('login')
        return
      }
      setActiveView('home')
    }

    window.addEventListener('popstate', syncViewFromUrl)
    return () => window.removeEventListener('popstate', syncViewFromUrl)
  }, [])

  useEffect(() => {
    if (!auth.isAuthenticated && activeView === 'home') {
      setActiveView('login')
      updateUrlForView('login', { replace: true })
      return
    }

    if (auth.isAuthenticated && (activeView === 'login' || activeView === 'register')) {
      setActiveView('home')
      updateUrlForView('home', { replace: true })
    }
  }, [activeView, auth.isAuthenticated, updateUrlForView])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem(ALARM_CANCELLED_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        alarmCancelledAtRef.current = parsed
        setAlarmCancelledAtByDevice(parsed)
      }
    } catch {
      // Ignore malformed persisted state.
    }
  }, [])

  const persistAlarmCancelledAtMap = useCallback((nextMap) => {
    alarmCancelledAtRef.current = nextMap
    setAlarmCancelledAtByDevice(nextMap)
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(ALARM_CANCELLED_STORAGE_KEY, JSON.stringify(nextMap))
    } catch {
      // Ignore local storage write failures.
    }
  }, [])

  const getDeviceAlarmCancelKeys = useCallback((entry) => {
    const keys = []
    const internalId = Number(entry?.id || entry?.deviceId || 0)
    const externalId = String(entry?.externalDeviceId || entry?.external_device_id || '').trim()
    if (internalId) keys.push(`id:${internalId}`)
    if (externalId) keys.push(`ext:${externalId}`)
    return keys
  }, [])

  const wasAlarmCancelledAfterEvent = useCallback((update) => {
    if (!update) return false
    const eventMs = new Date(update?.updatedAt || update?.receivedAt || update?.timestamp || 0).getTime()
    if (!eventMs) return false

    const cancelKeys = getDeviceAlarmCancelKeys(update)
    if (!cancelKeys.length) return false

    return cancelKeys.some((key) => {
      const cancelledAt = alarmCancelledAtRef.current?.[key]
      if (!cancelledAt) return false
      const cancelledMs = new Date(cancelledAt).getTime()
      return Number.isFinite(cancelledMs) && cancelledMs >= eventMs
    })
  }, [getDeviceAlarmCancelKeys])

  const applyRealtimeAlarmUpdate = useCallback((update) => {
    const normalizedUpdate = normalizeAlarmUpdatePayload(update)
    if (!normalizedUpdate) return

    const deviceId = Number(normalizedUpdate.deviceId || 0)
    const externalDeviceId = String(normalizedUpdate.externalDeviceId || '').trim()
    if (!deviceId && !externalDeviceId) return

    setAlarmStateByDevice((prev) => {
      const next = { ...prev }
      if (deviceId) next[`id:${deviceId}`] = normalizedUpdate
      if (externalDeviceId) next[`ext:${externalDeviceId}`] = normalizedUpdate
      return next
    })

    setAlarmFeed((prev) => {
      const updateKey = `${normalizedUpdate?.deviceId || '-'}:${normalizedUpdate?.externalDeviceId || '-'}`
      const updatedAtMs = new Date(normalizedUpdate?.updatedAt || normalizedUpdate?.receivedAt || normalizedUpdate?.timestamp || Date.now()).getTime()
      const filtered = prev.filter((entry) => {
        const entryKey = `${entry?.deviceId || '-'}:${entry?.externalDeviceId || '-'}`
        const entryUpdatedAtMs = new Date(entry?.updatedAt || entry?.receivedAt || entry?.timestamp || 0).getTime()
        if (entryKey !== updateKey) return true
        return entryUpdatedAtMs > updatedAtMs
      })
      return [normalizedUpdate, ...filtered].slice(0, 30)
    })
  }, [])

  const commonHeaders = useCallback(
    () => ({
      ...(gatewayBaseUrl.trim() ? { 'X-Gateway-Base-Url': gatewayBaseUrl.trim() } : {}),
      ...(gatewayToken.trim() ? { Authorization: gatewayToken.trim() } : {}),
      ...(auth.token ? { 'X-Auth-Token': auth.token } : {})
    }),
    [gatewayBaseUrl, gatewayToken, auth.token]
  )

  const cancelDeviceAlarm = useCallback(
    async (device) => {
      const internalId = Number(device?.id || device?.deviceId || 0)
      const externalId = String(device?.externalDeviceId || device?.external_device_id || '').trim()
      if (!internalId && !externalId) throw new Error('Unable to resolve device id for alarm cancellation.')

      const cancelledAt = new Date().toISOString()
      const payload = {
        alarmCode: null,
        alarm_code: null,
        alertCode: null,
        alert_code: null,
        alarmTriggeredAt: null,
        alarm_triggered_at: null,
        alarmCancelledAt: cancelledAt,
        alarm_cancelled_at: cancelledAt
      }

      const resolvedInternalId = internalId
      if (!resolvedInternalId) throw new Error('Missing internal device id for alarm cancellation.')

      const { response } = await fetchWithFallback(`/api/devices/${resolvedInternalId}`, {
        method: 'PATCH',
        headers: {
          ...commonHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
      if (!response.ok) {
        throw new Error('Unable to cancel alarm for device.')
      }

      const cancelKeys = getDeviceAlarmCancelKeys(device)
      const nextCancelledMap = { ...alarmCancelledAtRef.current }
      cancelKeys.forEach((key) => {
        nextCancelledMap[key] = cancelledAt
      })
      persistAlarmCancelledAtMap(nextCancelledMap)

      applyRealtimeAlarmUpdate({
        deviceId: resolvedInternalId || undefined,
        externalDeviceId: externalId || undefined,
        alarmCode: null,
        alarmTriggeredAt: null,
        alarmCancelledAt: cancelledAt,
        updatedAt: cancelledAt,
        source: 'portal-cancel'
      })
    },
    [applyRealtimeAlarmUpdate, commonHeaders, getDeviceAlarmCancelKeys, persistAlarmCancelledAtMap]
  )

  useEffect(() => {
    persistAuth(auth)
  }, [auth])

  useEffect(() => {
    if (!auth.isAuthenticated || activeView !== 'home') {
      setAlarmStreamConnected(false)
      return undefined
    }

    const stop = startAlarmStream(
      (update) => {
        applyRealtimeAlarmUpdate(update)

        const normalized = String(update?.alarmCode || '').toLowerCase()
        if (normalized.includes('sos') || normalized.includes('fall')) {
          if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate([180, 120, 180, 120, 240])
          }
        }
      },
      {
        baseUrl: gatewayBaseUrl || import.meta.env.VITE_API_URL,
        onConnected: () => setAlarmStreamConnected(true),
        onError: () => setAlarmStreamConnected(false)
      }
    )

    return () => {
      stop()
      setAlarmStreamConnected(false)
    }
  }, [auth.isAuthenticated, activeView, gatewayBaseUrl, applyRealtimeAlarmUpdate])

  useEffect(() => {
    if (!auth.isAuthenticated || activeView !== 'home') return undefined

    const section = String(homeActiveSection || '').toLowerCase()
    const shouldListenForWebhookAlerts = section === 'dashboard' || section === 'devices'
    if (!shouldListenForWebhookAlerts) return undefined

    let isCancelled = false
    let lastSeenWebhookTimestamp = 0
    const lastSeenWebhookEventKeys = new Set()

    const persistWebhookAlarmCode = async (update) => {
      const internalDeviceId = Number(update?.deviceId || 0)
      const externalDeviceId = String(update?.externalDeviceId || '').trim()
      const resolvedAlarmCode = normalizeWebhookAlarmCode(update?.alarmCode)
      if ((!internalDeviceId && !externalDeviceId) || resolvedAlarmCode === undefined) return

      let resolvedDeviceId = internalDeviceId

      if (!resolvedDeviceId && externalDeviceId) {
        try {
          const { response } = await fetchWithFallback('/api/devices', { headers: commonHeaders() })
          const body = await response.json().catch(() => null)
          if (response.ok && Array.isArray(body)) {
            const match = body.find((device) => {
              const candidateExternal = String(
                device?.externalDeviceId ||
                device?.external_device_id ||
                device?.deviceId ||
                ''
              ).trim()
              return candidateExternal && candidateExternal === externalDeviceId
            })
            resolvedDeviceId = Number(match?.id || 0)
          }
        } catch {
          // Best-effort only.
        }
      }

      if (!resolvedDeviceId) return

      try {
        const eventTimestamp = update?.updatedAt || new Date().toISOString()
        const hasActiveAlarm = resolvedAlarmCode !== null
        const { response } = await fetchWithFallback(`/api/devices/${resolvedDeviceId}`, {
          method: 'PATCH',
          headers: {
            ...commonHeaders(),
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            alarmCode: resolvedAlarmCode,
            alarm_code: resolvedAlarmCode,
            alertCode: resolvedAlarmCode,
            alert_code: resolvedAlarmCode,
            alarmTriggeredAt: hasActiveAlarm ? eventTimestamp : null,
            alarm_triggered_at: hasActiveAlarm ? eventTimestamp : null,
            alarmCancelledAt: hasActiveAlarm ? null : undefined,
            alarm_cancelled_at: hasActiveAlarm ? null : undefined
          })
        })

        if (!response.ok) {
          await fetchWithFallback(`/api/devices/${resolvedDeviceId}`, {
            method: 'PUT',
            headers: {
              ...commonHeaders(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              alarmCode: resolvedAlarmCode,
              alarm_code: resolvedAlarmCode,
              alertCode: resolvedAlarmCode,
              alert_code: resolvedAlarmCode,
              alarmTriggeredAt: hasActiveAlarm ? eventTimestamp : null,
              alarm_triggered_at: hasActiveAlarm ? eventTimestamp : null,
              alarmCancelledAt: hasActiveAlarm ? null : undefined,
              alarm_cancelled_at: hasActiveAlarm ? null : undefined
            })
          })
        }
      } catch {
        // Persisting alarm state from webhook events is best effort.
      }
    }

    const parseWebhookAlarmUpdate = (event) => {
      const payload =
        event?.payload?.data ||
        event?.payload ||
        event?.data ||
        event?.rawEvent?.data ||
        event?.rawEvent ||
        event

      const generalData =
        payload?.data?.['General Data'] ||
        payload?.data?.generalData ||
        payload?.data?.general_data ||
        payload?.['General Data'] ||
        payload?.generalData ||
        payload?.general_data ||
        null

      const alarmCodeRaw =
        payload?.alarmCode ||
        payload?.alarm_code ||
        payload?.alertCode ||
        payload?.alert_code ||
        payload?.eventCode ||
        payload?.event_code ||
        payload?.data?.['General Data']?.['Alarm Code'] ||
        payload?.data?.['General Data']?.alarmCode ||
        payload?.data?.['General Data']?.alarm_code ||
        payload?.['General Data']?.['Alarm Code'] ||
        payload?.['General Data']?.alarmCode ||
        payload?.['General Data']?.alarm_code ||
        generalData?.['Alarm Code'] ||
        generalData?.alarmCode ||
        generalData?.alarm_code ||
        payload?.data?.['Alarm Code'] ||
        payload?.data?.alarmCode ||
        payload?.data?.alarm_code ||
        payload?.data?.alertCode ||
        payload?.data?.alert_code ||
        payload?.['Alarm Code'] ||
        payload?.['Alert Code'] ||
        payload?.alarmCodes ||
        payload?.alarm_codes ||
        payload?.alertCodes ||
        payload?.alert_codes ||
        payload?.event?.code ||
        null

      if (alarmCodeRaw === null || alarmCodeRaw === undefined) return null

      const alarmCode = normalizeWebhookAlarmCode(alarmCodeRaw)

      const deviceId = Number(payload?.internalDeviceId || payload?.internal_device_id || event?.internalDeviceId || 0)
      const externalDeviceId = String(
        payload?.externalDeviceId ||
        payload?.external_device_id ||
        payload?.deviceId ||
        payload?.device_id ||
        payload?.imei ||
        payload?.deviceImei ||
        event?.deviceId ||
        event?.device_id ||
        event?.externalDeviceId ||
        ''
      ).trim()

      if (!deviceId && !externalDeviceId) return null

      return {
        deviceId: deviceId || undefined,
        externalDeviceId: externalDeviceId || undefined,
        alarmCode,
        updatedAt: event?.receivedAt || event?.timestamp || event?.createdAt || new Date().toISOString(),
        source: 'webhook-events'
      }
    }

    const pollWebhookAlerts = async () => {
      const endpoints = ['/api/webhooks/ev12/events', 'http://localhost:8090/api/webhooks/ev12/events']

      for (const endpoint of endpoints) {
        try {
          const { response } = await fetchWithFallback(endpoint, { headers: commonHeaders() })
          const body = await response.json().catch(() => null)
          if (!response.ok || !body) continue

          const events = Array.isArray(body) ? body : [body]
          const sortedEvents = [...events].sort((left, right) => {
            const leftMs = new Date(left?.receivedAt || left?.timestamp || left?.createdAt || 0).getTime()
            const rightMs = new Date(right?.receivedAt || right?.timestamp || right?.createdAt || 0).getTime()
            return leftMs - rightMs
          })

          for (const event of sortedEvents) {
            if (isCancelled) return
            const eventTimestamp = new Date(event?.receivedAt || event?.timestamp || event?.createdAt || 0).getTime()
            if (eventTimestamp < lastSeenWebhookTimestamp) continue

            const eventKey = [
              event?.id,
              event?.eventId,
              event?.receivedAt,
              event?.timestamp,
              JSON.stringify(event?.payload?.data || event?.payload || event?.data || event?.rawEvent?.data || event?.rawEvent || {})
            ].join('::')

            if (eventTimestamp === lastSeenWebhookTimestamp && lastSeenWebhookEventKeys.has(eventKey)) continue

            const update = parseWebhookAlarmUpdate(event)
            if (update) {
              if (String(update?.alarmCode || '').toLowerCase().includes('sos') && wasAlarmCancelledAfterEvent(update)) {
                continue
              }
              applyRealtimeAlarmUpdate(update)
              await persistWebhookAlarmCode(update)
            }

            if (eventTimestamp > lastSeenWebhookTimestamp) {
              lastSeenWebhookTimestamp = eventTimestamp
              lastSeenWebhookEventKeys.clear()
            }
            if (eventTimestamp === lastSeenWebhookTimestamp) lastSeenWebhookEventKeys.add(eventKey)
          }

          return
        } catch {
          // Best-effort fallback between endpoints.
        }
      }
    }

    pollWebhookAlerts()
    const intervalId = setInterval(pollWebhookAlerts, 2000)

    return () => {
      isCancelled = true
      clearInterval(intervalId)
    }
  }, [auth.isAuthenticated, activeView, homeActiveSection, commonHeaders, applyRealtimeAlarmUpdate])

  const commandPreview = useMemo(() => buildEv12Preview(configForm, configBaseline), [configForm, configBaseline])
  const draftCommandPreview = useMemo(
    () => (configBaseline ? buildEv12Preview(configForm, configBaseline) : ''),
    [configForm, configBaseline]
  )
  const formattedReplies = useMemo(
    () => (replies.length ? replies.map(formatReply).join('\n') : 'No replies loaded yet.'),
    [replies]
  )

  const fetchRepliesData = useCallback(
    async ({ sinceValue = lastSeenTimestamp, phoneOverride = '' } = {}) => {
      const phoneFilter = (phoneOverride || lastSentPhone || phone.trim() || configForm.contactNumber?.trim() || '').trim()
      const params = new URLSearchParams({ since: String(sinceValue), limit: '50' })
      if (phoneFilter) params.set('phone', phoneFilter)

      const endpoints = [`/api/messages/replies?${params.toString()}`, `/api/inbound-messages?${params.toString()}`]

      let data = null
      let lastError = null

      for (const endpoint of endpoints) {
        try {
          const { response } = await fetchWithFallback(endpoint, { headers: commonHeaders() })
          const body = await response.json().catch(() => ({}))
          if (!response.ok) throw new Error(body.error || body.message || `Unable to fetch replies from ${endpoint}`)
          data = body
          break
        } catch (error) {
          lastError = error
        }
      }

      if (!data) throw lastError || new Error('Unable to fetch replies')

      const incoming = Array.isArray(data.messages)
        ? data.messages
        : Array.isArray(data.replies)
          ? data.replies
          : Array.isArray(data)
            ? data
            : []

      const newTimestamp = Number(data.lastSeenTimestamp || data.since || Date.now())
      return {
        incoming,
        newTimestamp: Number.isFinite(newTimestamp) ? newTimestamp : Date.now(),
        phoneFilter
      }
    },
    [commonHeaders, lastSeenTimestamp, lastSentPhone, phone, configForm.contactNumber]
  )

  const updateLocationFromReplies = useCallback((incoming) => {
    const locReply = [...incoming].reverse().find((entry) => {
      const text = replyText(entry)
      return /gps\s*loc|loc\s*time|google\.com\/maps\?q=|maps\?q=/i.test(text)
    })

    if (!locReply) return false

    const text = replyText(locReply)
    const extracted = extractLocationFromText(text)
    if (!extracted) return false

    setLocationResult({
      ...extracted,
      rawMessage: text,
      from: locReply.from || locReply.phone || 'Unknown',
      receivedAt: Number(locReply.date || Date.now())
    })

    return true
  }, [])

  const fetchLocationFromWebhook = useCallback(async () => {
    const endpoints = ['/api/webhooks/ev12/events', 'http://localhost:8090/api/webhooks/ev12/events']
    const requestedDeviceId = String(configForm.deviceId || '').trim()

    for (const endpoint of endpoints) {
      try {
        const { response } = await fetchWithFallback(endpoint, { headers: commonHeaders() })
        const body = await response.json().catch(() => null)
        if (!response.ok) continue

        const events = Array.isArray(body) ? body : [body]
        const sortedEvents = [...events].sort((a, b) => {
          const left = new Date(a?.receivedAt || a?.timestamp || a?.createdAt || 0).getTime()
          const right = new Date(b?.receivedAt || b?.timestamp || b?.createdAt || 0).getTime()
          return right - left
        })

        for (const event of sortedEvents) {
          const payload = event?.payload || event?.rawEvent || event
          const eventDeviceId = String(
            payload?.deviceId || payload?.data?.deviceId || event?.deviceId || ''
          ).trim()

          if (requestedDeviceId && eventDeviceId && eventDeviceId !== requestedDeviceId) continue

          const extracted = extractLocationFromWebhookPayload(payload)
          if (!extracted) continue

          setLocationResult({
            ...extracted,
            from: event?.source || event?.provider || 'Webhook Event',
            receivedAt: Number(new Date(event?.receivedAt || event?.timestamp || Date.now()).getTime()) || Date.now()
          })
          return true
        }
      } catch {
        // Best effort fallback only.
      }
    }

    return false
  }, [commonHeaders, configForm.deviceId])

  const handleRegister = async () => {
    try {
      const selectedRole = Number(registerForm.userRole)
      const roleForSelfRegistration = selectedRole === 2 || selectedRole === 3 ? selectedRole : 3

      const payload = {
        ...registerForm,
        userRole: roleForSelfRegistration,
        locationId: registerForm.locationId ? Number(registerForm.locationId) : null,
        managerId: registerForm.managerId ? Number(registerForm.managerId) : null
      }

      const { response } = await fetchWithFallback('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Registration failed')

      setAuthStatus(`Registered ${data.email} successfully.`)
      setActiveView('login')
      updateUrlForView('login', { replace: true })
    } catch (error) {
      setAuthStatus(`Register failed: ${error.message}`)
    }
  }

  const handleLogin = async () => {
    const email = loginForm.email.trim()
    const password = loginForm.password

    if (!email || !password) {
      setAuthStatus('Login validation: email and password are required.')
      return
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setAuthStatus('Login validation: enter a valid email address.')
      return
    }

    setAuthLoading(true)
    setAuthStatus('Signing in...')

    try {
      const { response } = await fetchWithFallback('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        const loginError = data.error || data.message || 'Login failed'
        throw new Error(response.status === 401 ? `${loginError}. Please check your email/password.` : loginError)
      }

      dispatchAuth({ type: 'LOGIN_SUCCESS', payload: data })
      setAuthStatus(`Logged in as ${data.user.firstName} ${data.user.lastName} (role ${data.user.userRole}).`)
      setActiveView('home')
      updateUrlForView('home', { replace: true })
    } catch (error) {
      setAuthStatus(`Login failed: ${error.message}`)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = () => {
    dispatchAuth({ type: 'LOGOUT' })
    setAlarmStateByDevice({})
    setAlarmFeed([])
    setAlarmStreamConnected(false)
    setAuthStatus('Logged out successfully.')
    setActiveView('login')
    updateUrlForView('login', { replace: true })
  }

  const handleSendMessage = async () => {
    const to = phone.trim()
    const body = message.trim()

    if (!to || !body) {
      setStatus('Phone and message are required.')
      return
    }

    setLoading(true)
    try {
      const { response } = await fetchWithFallback('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...commonHeaders() },
        body: JSON.stringify({ to, message: body })
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Unable to send message')

      setLastSentPhone(to)
      setStatus(`Message sent to ${to}.`)
    } catch (error) {
      setStatus(`Send failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleFetchReplies = useCallback(async () => {
    setLoading(true)

    try {
      const { incoming, newTimestamp, phoneFilter } = await fetchRepliesData()
      setReplies(incoming)
      setLastSeenTimestamp(newTimestamp)
      updateLocationFromReplies(incoming)
      setStatus(`Loaded ${incoming.length} replies${phoneFilter ? ` for ${phoneFilter}` : ''}.`)
    } catch (error) {
      setStatus(`Fetch failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }, [fetchRepliesData, updateLocationFromReplies])

  const handleRequestLocation = async () => {
    const targetPhone = (configForm.contactNumber?.trim() || phone.trim() || lastSentPhone || '').trim()
    if (!targetPhone) {
      setStatus('Location request failed: no device phone number set.')
      return
    }

    setLoading(true)
    try {
      const { response } = await fetchWithFallback('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...commonHeaders() },
        body: JSON.stringify({ to: targetPhone, message: 'Loc' })
      })

      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || body.message || 'Unable to send loc command')

      setLastSentPhone(targetPhone)
      setStatus(`Loc command sent to ${targetPhone}. Waiting for device reply...`)

      let sinceCursor = lastSeenTimestamp
      for (let attempt = 1; attempt <= 12; attempt += 1) {
        await sleep(3000)
        const { incoming, newTimestamp } = await fetchRepliesData({ sinceValue: sinceCursor, phoneOverride: targetPhone })

        if (incoming.length) {
          setReplies((prev) => {
            const merged = [...incoming, ...prev]
            const unique = []
            const seen = new Set()
            for (const item of merged) {
              const key = `${item?.date || ''}-${item?.from || ''}-${replyText(item)}`
              if (seen.has(key)) continue
              seen.add(key)
              unique.push(item)
            }
            return unique
          })

          setLastSeenTimestamp(newTimestamp)
          const foundLocation = updateLocationFromReplies(incoming)
          if (foundLocation) {
            setStatus('Location reply received and mapped.')
            return
          }
        }

        sinceCursor = newTimestamp
        setStatus(`Waiting for location reply... (${attempt}/12)`)
      }

      const foundWebhookLocation = await fetchLocationFromWebhook()
      if (foundWebhookLocation) {
        setStatus('No SMS location parsed. Used latest webhook GPS coordinates instead.')
        return
      }

      setStatus('No location reply received yet. You can try again or use Fetch Replies manually.')
    } catch (error) {
      setStatus(`Location request failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSendConfig = async (formOverride = null) => {
    const activeConfigForm = formOverride && typeof formOverride === 'object' ? formOverride : configForm
    const to = activeConfigForm.contactNumber?.trim() || phone.trim()
    const normalizedDeviceId = Number(activeConfigForm.deviceId)
    const hasDeviceId = Number.isInteger(normalizedDeviceId) && normalizedDeviceId > 0
    let command = buildEv12Preview(activeConfigForm, configBaseline).trim()

    if (!to) {
      setConfigStatus('Config failed: device/contact number is required.')
      return
    }

    setLoading(true)
    setConfigStatus('Sending configuration...')
    try {
      const authorizedNumbersForValidation = Array.isArray(activeConfigForm.authorizedNumbers)
        ? activeConfigForm.authorizedNumbers
        : [activeConfigForm.contactNumber || activeConfigForm.contacts?.[0]?.phone || '']
      buildEviewSmsAccessSetup({
        authorizedNumbers: authorizedNumbersForValidation,
        restrictedAccess: Boolean(activeConfigForm.smsWhitelistEnabled)
      })

      const protocolSettings = { ...activeConfigForm }
      let baselineForDiff = (configBaseline && typeof configBaseline === 'object')
        ? { ...configBaseline, deviceId: hasDeviceId ? normalizedDeviceId : configBaseline.deviceId }
        : null

      if (hasDeviceId) {
        try {
          const { response } = await fetchWithFallback(`/api/devices/${normalizedDeviceId}`, {
            headers: commonHeaders()
          })
          const deviceBody = await response.json().catch(() => ({}))
          if (response.ok && deviceBody?.protocolSettings && typeof deviceBody.protocolSettings === 'object') {
            baselineForDiff = {
              ...(baselineForDiff || {}),
              ...deviceBody.protocolSettings,
              deviceId: normalizedDeviceId
            }
          }
        } catch {
          // Best effort only: continue with current preview if baseline refresh fails.
        }
      }

      if (baselineForDiff) {
        command = buildEv12Preview(activeConfigForm, baselineForDiff).trim()
      }

      if (!command) {
        setConfigStatus('Config failed: no updates detected for this device.')
        return
      }

      const changedProtocolSettings = pickChangedFields(activeConfigForm, baselineForDiff)

      const payload = {
        ...activeConfigForm,
        deviceId: hasDeviceId ? normalizedDeviceId : activeConfigForm.deviceId,
        protocolSettings: changedProtocolSettings,
        to,
        command
      }

      if (activeConfigForm.applyGatewayToAllDevices) {
        const gatewaySetup = buildEviewSmsAccessSetup({
          authorizedNumbers: Array.isArray(activeConfigForm.authorizedNumbers)
            ? activeConfigForm.authorizedNumbers
            : [activeConfigForm.contactNumber || activeConfigForm.contacts?.[0]?.phone || ''],
          restrictedAccess: Boolean(activeConfigForm.smsWhitelistEnabled)
        })
        payload.bulkGatewaySettings = {
          enabled: true,
          gatewayNumber: gatewaySetup.config.authorizedNumbers[0]?.number || '',
          smsQueue: gatewaySetup.smsQueue
        }
      }
      const endpoints = ['/api/send-config', '/api/config/send', '/api/messages/send']

      let data = null
      let lastError = null

      for (const endpoint of endpoints) {
        try {
          const body = endpoint === '/api/messages/send' ? { to, message: command } : payload
          const { response } = await fetchWithFallback(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...commonHeaders() },
            body: JSON.stringify(body)
          })

          const responseBody = await response.json().catch(() => ({}))
          if (!response.ok) {
            throw new Error(responseBody.error || responseBody.message || `Unable to send configuration via ${endpoint}`)
          }

          data = responseBody
          break
        } catch (error) {
          lastError = error
        }
      }

      if (!data) throw lastError || new Error('Unable to send configuration')

      let persisted = false
      let persistError = null

      if (hasDeviceId) {
        try {
          const { response } = await fetchWithFallback(`/api/devices/${normalizedDeviceId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...commonHeaders() },
            body: JSON.stringify({ protocolSettings })
          })

          const responseBody = await response.json().catch(() => ({}))
          if (!response.ok) {
            throw new Error(responseBody.error || responseBody.message || 'Unable to persist device configuration')
          }

          persisted = true
        } catch (error) {
          persistError = error
        }
      }

      setConfigResult(data)
      setStatus(`Message sent to ${to}.`)

      if (hasDeviceId) {
        queuedCommandByDeviceRef.current[normalizedDeviceId] = command
        const queueStatus = {
          deviceId: normalizedDeviceId,
          status: String(data.status || data.configStatus || 'PENDING').toUpperCase(),
          pending: String(data.status || data.configStatus || 'PENDING').toUpperCase() === 'PENDING',
          lastSentAt: data.sentAt || data.lastSentAt || new Date().toISOString(),
          appliedAt: data.appliedAt || null,
          nextResendAt: data.nextResendAt || null,
          commandPreview: command,
          source: 'send'
        }
        setConfigQueue(queueStatus)
        setConfigBaseline(protocolSettings)
        setConfigForm(protocolSettings)
      }

      if (persisted) {
        setConfigStatus('Configuration sent successfully and saved to the device profile.')
      } else if (hasDeviceId && persistError) {
        setConfigStatus(`Configuration sent, but database sync failed: ${persistError.message}`)
      } else {
        setConfigStatus('Configuration sent successfully.')
      }
    } catch (error) {
      setConfigStatus(`Config failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const refreshConfigQueueStatus = useCallback(async (deviceIdOverride) => {
    const resolvedId = Number(deviceIdOverride || configForm.deviceId)
    if (!Number.isInteger(resolvedId) || resolvedId <= 0) return

    try {
      const { response } = await fetchWithFallback(`/api/devices/${resolvedId}/config-status`, {
        headers: commonHeaders()
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || body.message || 'Unable to load config queue status')

      const normalizedStatus = String(body.status || body.configStatus || 'IDLE').toUpperCase()
      if (normalizedStatus !== 'PENDING') {
        delete queuedCommandByDeviceRef.current[resolvedId]
      }
      setConfigQueue((prev) => ({
        deviceId: resolvedId,
        status: normalizedStatus,
        pending: body.pending ?? normalizedStatus === 'PENDING',
        lastSentAt: body.lastSentAt || body.configLastSentAt || null,
        appliedAt: body.appliedAt || body.configAppliedAt || null,
        nextResendAt: body.nextResendAt || null,
        commandPreview: queuedCommandByDeviceRef.current[resolvedId] || body.commandPreview || prev?.commandPreview || '',
        source: 'status'
      }))
    } catch (error) {
      setConfigStatus(`Queue status refresh failed: ${error.message}`)
    }
  }, [commonHeaders, configForm.deviceId])

  const resendPendingConfig = useCallback(async () => {
    const resolvedId = Number(configForm.deviceId)
    if (!Number.isInteger(resolvedId) || resolvedId <= 0) {
      setConfigStatus('Resend failed: select a device first.')
      return
    }

    setLoading(true)
    setConfigStatus('Resending pending configuration...')

    try {
      const { response } = await fetchWithFallback(`/api/devices/${resolvedId}/config-resend`, {
        method: 'POST',
        headers: commonHeaders()
      })

      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || body.message || 'Unable to resend pending config')

      setConfigResult(body)
      setConfigStatus('Pending command resent successfully.')
      await refreshConfigQueueStatus(resolvedId)
    } catch (error) {
      setConfigStatus(`Resend failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }, [commonHeaders, configForm.deviceId, refreshConfigQueueStatus])

  useEffect(() => {
    const resolvedId = Number(configForm.deviceId)
    if (!Number.isInteger(resolvedId) || resolvedId <= 0) {
      setConfigQueue(null)
      return
    }

    refreshConfigQueueStatus(resolvedId)
  }, [configForm.deviceId, refreshConfigQueueStatus])

  useEffect(() => {
    if (!configQueue?.pending || !configQueue.deviceId) return undefined

    const intervalId = setInterval(() => {
      refreshConfigQueueStatus(configQueue.deviceId)
    }, 15000)

    return () => clearInterval(intervalId)
  }, [configQueue?.pending, configQueue?.deviceId, refreshConfigQueueStatus])

  return (
    <main className={`container ${activeView === 'home' ? 'container-home' : 'container-auth'}`}>
      {activeView === 'home' ? (
        <Navbar
          user={auth.user}
          alarmStreamConnected={alarmStreamConnected}
        />
      ) : null}

      {activeView === 'login' && (
        <Suspense fallback={<div className="card">Loading login…</div>}>
          <LoginView
          loginForm={loginForm}
          setLoginForm={setLoginForm}
          onLogin={handleLogin}
          session={auth.isAuthenticated ? auth : null}
          onGoRegister={() => {
            setActiveView('register')
            updateUrlForView('register')
          }}
          authStatus={authStatus}
          authLoading={authLoading}
          />
        </Suspense>
      )}

      {activeView === 'register' && (
        <Suspense fallback={<div className="card">Loading registration…</div>}>
          <RegisterView
          registerForm={registerForm}
          setRegisterForm={setRegisterForm}
          onRegister={handleRegister}
          onGoLogin={() => {
            setActiveView('login')
            updateUrlForView('login')
          }}
          />
        </Suspense>
      )}

      {activeView === 'home' && (
        <Suspense fallback={<div className="card">Loading dashboard…</div>}>
          <HomeView
          user={auth.user}
          authStatus={authStatus}
          onLogout={handleLogout}
          gatewayBaseUrl={gatewayBaseUrl}
          gatewayToken={gatewayToken}
          setGatewayBaseUrl={setGatewayBaseUrl}
          setGatewayToken={setGatewayToken}
          configForm={configForm}
          setConfigForm={setConfigForm}
          configBaseline={configBaseline}
          setConfigBaseline={setConfigBaseline}
          draftCommandPreview={draftCommandPreview}
          configStatus={configStatus}
          configResult={configResult}
          configQueue={configQueue}
          sendConfig={handleSendConfig}
          refreshConfigQueueStatus={refreshConfigQueueStatus}
          resendPendingConfig={resendPendingConfig}
          loading={loading}
          phone={phone}
          message={message}
          setPhone={setPhone}
          setMessage={setMessage}
          sendMessage={handleSendMessage}
          fetchReplies={handleFetchReplies}
          requestLocationUpdate={handleRequestLocation}
          locationResult={locationResult}
          status={status}
          formattedReplies={formattedReplies}
          replies={replies}
          repliesCount={replies.length}
          authToken={auth.token}
          alarmStateByDevice={alarmStateByDevice}
          alarmFeed={alarmFeed}
          alarmStreamConnected={alarmStreamConnected}
          onSectionChange={setHomeActiveSection}
          onCancelDeviceAlarm={cancelDeviceAlarm}
          alarmCancelledAtByDevice={alarmCancelledAtByDevice}
          />
        </Suspense>
      )}
    </main>
  )
}
