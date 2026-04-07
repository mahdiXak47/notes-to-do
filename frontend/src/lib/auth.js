const ACCESS_KEY = 'notes_auth_access'
const REFRESH_KEY = 'notes_auth_refresh'
const USERNAME_KEY = 'notes_auth_username'

function apiOrigin() {
  const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
  return base || ''
}

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`
  const origin = apiOrigin()
  return origin ? `${origin}${p}` : p
}

function decodeJwtPayload(token) {
  try {
    const part = token.split('.')[1]
    if (!part) return null
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
    return JSON.parse(atob(b64 + pad))
  } catch {
    return null
  }
}

function accessExpiresAtMs(token) {
  const p = decodeJwtPayload(token)
  if (!p?.exp) return null
  return p.exp * 1000
}

function isAccessValid(token, skewMs = 5000) {
  if (!token) return false
  const expMs = accessExpiresAtMs(token)
  if (!expMs) return false
  return expMs > Date.now() + skewMs
}

export async function registerUser({ firstName, lastName, username, email, password }) {
  const res = await fetch(apiUrl('/api/auth/register/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      first_name: firstName,
      last_name: lastName,
      username,
      email,
      password,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const firstError =
      data.detail ||
      data.username?.[0] ||
      data.email?.[0] ||
      data.password?.[0] ||
      data.first_name?.[0] ||
      data.last_name?.[0] ||
      'Registration failed.'
    throw new Error(typeof firstError === 'string' ? firstError : 'Registration failed.')
  }
}

export async function loginWithPassword(username, password) {
  const res = await fetch(apiUrl('/api/auth/token/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg =
      data.detail ||
      (typeof data === 'object' && data.non_field_errors?.[0]) ||
      'Invalid username or password.'
    throw new Error(typeof msg === 'string' ? msg : 'Login failed.')
  }
  if (!data.access || !data.refresh) {
    throw new Error('Login failed.')
  }
  localStorage.setItem(ACCESS_KEY, data.access)
  localStorage.setItem(REFRESH_KEY, data.refresh)
  localStorage.setItem(USERNAME_KEY, username)
}

export async function refreshAccessToken() {
  const refresh = localStorage.getItem(REFRESH_KEY)
  if (!refresh) return false
  const res = await fetch(apiUrl('/api/auth/token/refresh/'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  })
  if (!res.ok) return false
  const data = await res.json().catch(() => ({}))
  if (!data.access) return false
  localStorage.setItem(ACCESS_KEY, data.access)
  return true
}

export async function ensureSession() {
  const access = localStorage.getItem(ACCESS_KEY)
  if (isAccessValid(access)) return true
  if (await refreshAccessToken()) return true
  clearStoredToken()
  return false
}

export function getStoredUsername() {
  return localStorage.getItem(USERNAME_KEY) || ''
}

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY)
}

export function authHeaders() {
  const t = getAccessToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export async function authorizedFetch(path, options = {}) {
  const ok = await ensureSession()
  if (!ok) {
    throw new Error('Session expired.')
  }
  const headers = {
    ...options.headers,
    ...authHeaders(),
  }
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData
  const isUrlEncoded =
    typeof URLSearchParams !== 'undefined' &&
    options.body instanceof URLSearchParams
  if (options.body != null && !headers['Content-Type'] && !isFormData && !isUrlEncoded) {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(apiUrl(path), { ...options, headers })
  if (res.status === 401) {
    if (await refreshAccessToken()) {
      const retryHeaders = {
        ...options.headers,
        ...authHeaders(),
      }
      if (
        options.body != null &&
        !retryHeaders['Content-Type'] &&
        !isFormData &&
        !isUrlEncoded
      ) {
        retryHeaders['Content-Type'] = 'application/json'
      }
      return fetch(apiUrl(path), { ...options, headers: retryHeaders })
    }
    clearStoredToken()
  }
  return res
}

export function clearStoredToken() {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem(USERNAME_KEY)
}

export const AUTH_STORAGE_KEY = ACCESS_KEY
