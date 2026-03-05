export const AUTH_STORAGE_KEY = 'ev12-auth-store'

export const initialAuthState = {
  isAuthenticated: false,
  user: null,
  token: ''
}

export const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      return {
        isAuthenticated: true,
        user: action.payload.user,
        token: action.payload.token || ''
      }
    case 'LOGOUT':
      return initialAuthState
    default:
      return state
  }
}

export const loadPersistedAuth = () => {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return initialAuthState
    const parsed = JSON.parse(raw)
    if (!parsed?.isAuthenticated) return initialAuthState
    return {
      isAuthenticated: true,
      user: parsed.user || null,
      token: parsed.token || ''
    }
  } catch {
    return initialAuthState
  }
}

export const persistAuth = (auth) => {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth))
}
