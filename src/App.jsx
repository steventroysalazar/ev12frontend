import { useMemo, useState } from 'react'
import Navbar from './components/navbar/Navbar'
import HomeView from './features/home/HomeView'
import LoginView from './features/login/LoginView'
import RegisterView from './features/register/RegisterView'
import { buildEv12Preview, formatReply, initialConfigForm } from './features/home/ev12'
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
  const [activeView, setActiveView] = useState('login')
  const [authStatus, setAuthStatus] = useState('Not logged in.')
  const [session, setSession] = useState(null)

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

  const commandPreview = useMemo(() => buildEv12Preview(configForm), [configForm])
  const formattedReplies = useMemo(
    () => (replies.length ? replies.map(formatReply).join('\n') : 'No replies loaded yet.'),
    [replies]
  )

  const commonHeaders = () => ({
    ...(gatewayBaseUrl.trim() ? { 'X-Gateway-Base-Url': gatewayBaseUrl.trim() } : {}),
    ...(gatewayToken.trim() ? { Authorization: gatewayToken.trim() } : {})
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

      setSession(data)
      setAuthStatus(`Logged in as ${data.user.firstName} ${data.user.lastName} (role ${data.user.userRole}).`)
      setActiveView('home')
    } catch (error) {
      setAuthStatus(`Login failed: ${error.message}`)
    }
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
    setLoading(true)
    setConfigStatus('Sending configuration...')
    try {
      const response = await fetch('/api/config/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...commonHeaders() },
        body: JSON.stringify({ ...configForm, command: commandPreview })
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Unable to send configuration')

      setConfigResult(data)
      setConfigStatus('Configuration sent successfully.')
    } catch (error) {
      setConfigStatus(`Config failed: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="container">
      {activeView === 'home' ? (
        <Navbar />
      ) : null}

      {activeView === 'login' && (
        <LoginView
          loginForm={loginForm}
          setLoginForm={setLoginForm}
          onLogin={handleLogin}
          session={session}
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
        />
      )}
    </main>
  )
}
