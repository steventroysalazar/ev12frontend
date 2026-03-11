import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import Navbar from './components/navbar/Navbar'
import HomeView from './features/home/HomeView'
import LoginView from './features/login/LoginView'
import RegisterView from './features/register/RegisterView'
import { buildEv12Preview, formatReply, initialConfigForm } from './features/home/ev12'
import { fetchWithFallback } from './lib/apiClient'
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

const replyText = (reply) => String(reply?.message || reply?.text || reply?.body || '')

export default function App() {
  const [auth, dispatchAuth] = useReducer(authReducer, initialAuthState, loadPersistedAuth)
  const [activeView, setActiveView] = useState(auth.isAuthenticated ? 'home' : 'login')
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
  const [configForm, setConfigForm] = useState(initialConfigForm)
  const [locationResult, setLocationResult] = useState(null)

  useEffect(() => {
    persistAuth(auth)
  }, [auth])

  const commandPreview = useMemo(() => buildEv12Preview(configForm), [configForm])
  const formattedReplies = useMemo(
    () => (replies.length ? replies.map(formatReply).join('\n') : 'No replies loaded yet.'),
    [replies]
  )

  const commonHeaders = useCallback(
    () => ({
      ...(gatewayBaseUrl.trim() ? { 'X-Gateway-Base-Url': gatewayBaseUrl.trim() } : {}),
      ...(gatewayToken.trim() ? { Authorization: gatewayToken.trim() } : {}),
      ...(auth.token ? { 'X-Auth-Token': auth.token } : {})
    }),
    [gatewayBaseUrl, gatewayToken, auth.token]
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

  const handleRegister = async () => {
    try {
      const payload = {
        ...registerForm,
        userRole: Number(registerForm.userRole),
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
    } catch (error) {
      setAuthStatus(`Login failed: ${error.message}`)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleLogout = () => {
    dispatchAuth({ type: 'LOGOUT' })
    setAuthStatus('Logged out successfully.')
    setActiveView('login')
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

      setStatus('No location reply received yet. You can try again or use Fetch Replies manually.')
    } catch (error) {
      setStatus(`Location request failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSendConfig = async () => {
    const to = configForm.contactNumber?.trim() || phone.trim()
    const command = commandPreview.trim()
    const normalizedDeviceId = Number(configForm.deviceId)
    const hasDeviceId = Number.isInteger(normalizedDeviceId) && normalizedDeviceId > 0

    if (!to) {
      setConfigStatus('Config failed: device/contact number is required.')
      return
    }

    if (!command) {
      setConfigStatus('Config failed: no command generated yet.')
      return
    }

    setLoading(true)
    setConfigStatus('Sending configuration...')
    try {
      const protocolSettings = { ...configForm }
      const payload = {
        ...configForm,
        deviceId: hasDeviceId ? normalizedDeviceId : configForm.deviceId,
        protocolSettings,
        to,
        command
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

  return (
    <main className="container">
      {activeView === 'home' ? <Navbar user={auth.user} /> : null}

      {activeView === 'login' && (
        <LoginView
          loginForm={loginForm}
          setLoginForm={setLoginForm}
          onLogin={handleLogin}
          session={auth.isAuthenticated ? auth : null}
          onGoRegister={() => setActiveView('register')}
          authStatus={authStatus}
          authLoading={authLoading}
        />
      )}

      {activeView === 'register' && (
        <RegisterView
          registerForm={registerForm}
          setRegisterForm={setRegisterForm}
          onRegister={handleRegister}
          onGoLogin={() => setActiveView('login')}
        />
      )}

      {activeView === 'home' && (
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
          commandPreview={commandPreview}
          configStatus={configStatus}
          configResult={configResult}
          sendConfig={handleSendConfig}
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
        />
      )}
    </main>
  )
}
