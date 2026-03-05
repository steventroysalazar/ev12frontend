import { useEffect, useMemo, useReducer, useState } from 'react'
import Navbar from './components/navbar/Navbar'
import HomeView from './features/home/HomeView'
import LoginView from './features/login/LoginView'
import RegisterView from './features/register/RegisterView'
import { buildEv12Preview, formatReply, initialConfigForm } from './features/home/ev12'
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

export default function App() {
  const [auth, dispatchAuth] = useReducer(authReducer, initialAuthState, loadPersistedAuth)
  const [activeView, setActiveView] = useState(auth.isAuthenticated ? 'home' : 'login')
  const [authStatus, setAuthStatus] = useState(auth.isAuthenticated ? 'Authenticated session restored.' : 'Not logged in.')

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

  useEffect(() => {
    persistAuth(auth)
  }, [auth])

  const commandPreview = useMemo(() => buildEv12Preview(configForm), [configForm])
  const formattedReplies = useMemo(
    () => (replies.length ? replies.map(formatReply).join('\n') : 'No replies loaded yet.'),
    [replies]
  )

  const commonHeaders = () => ({
    ...(gatewayBaseUrl.trim() ? { 'X-Gateway-Base-Url': gatewayBaseUrl.trim() } : {}),
    ...(gatewayToken.trim() ? { Authorization: gatewayToken.trim() } : {}),
    ...(auth.token ? { 'X-Auth-Token': auth.token } : {})
  })

  const handleRegister = async () => {
    try {
      const payload = {
        ...registerForm,
        userRole: Number(registerForm.userRole),
        locationId: registerForm.locationId ? Number(registerForm.locationId) : null,
        managerId: registerForm.managerId ? Number(registerForm.managerId) : null
      }

      const response = await fetch('/api/auth/register', {
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
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Login failed')

      dispatchAuth({ type: 'LOGIN_SUCCESS', payload: data })
      setAuthStatus(`Logged in as ${data.user.firstName} ${data.user.lastName} (role ${data.user.userRole}).`)
      setActiveView('home')
    } catch (error) {
      setAuthStatus(`Login failed: ${error.message}`)
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
      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...commonHeaders() },
        body: JSON.stringify({ to, message: body })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to send message')

      setLastSentPhone(to)
      setStatus(`Message sent to ${to}.`)
    } catch (error) {
      setStatus(`Send failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleFetchReplies = async () => {
    setLoading(true)
    try {
      const response = await fetch(
        `/api/messages/replies?phone=${encodeURIComponent(lastSentPhone)}&since=${lastSeenTimestamp}`,
        { headers: commonHeaders() }
      )
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to fetch replies')

      const incoming = Array.isArray(data.messages) ? data.messages : []
      const newTimestamp = Number(data.lastSeenTimestamp || lastSeenTimestamp)

      setReplies(incoming)
      setLastSeenTimestamp(newTimestamp)
      setStatus(`Loaded ${incoming.length} replies.`)
    } catch (error) {
      setStatus(`Fetch failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleSendConfig = async () => {
    const to = configForm.contactNumber?.trim() || phone.trim()
    const command = commandPreview.trim()

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
      const payload = { ...configForm, to, command }
      const endpoints = ['/api/send-config', '/api/config/send', '/api/messages/send']

      let data = null
      let lastError = null

      for (const endpoint of endpoints) {
        try {
          const body = endpoint === '/api/messages/send' ? { to, message: command } : payload
          const response = await fetch(endpoint, {
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

      setConfigResult(data)
      setStatus(`Message sent to ${to}.`)
      setConfigStatus('Configuration sent successfully.')
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
          status={status}
          formattedReplies={formattedReplies}
          repliesCount={replies.length}
          authToken={auth.token}
        />
      )}
    </main>
  )
}
