import * as jose from 'jose'

export const AUTH_STORAGE_KEY = 'notes_auth_jwt'

const LOGIN_USERNAME = 'mahdixak'
const LOGIN_PASSWORD =
  'wJExo2bg3DQ1PwgUDUWnLkW3x71DWka1zV9K5tsEltk'

const SECRET = new TextEncoder().encode(
  import.meta.env.VITE_JWT_SECRET ??
    'notes-to-do-client-only-hs256-secret-min-length-32',
)

export function credentialsMatch(username, password) {
  return username === LOGIN_USERNAME && password === LOGIN_PASSWORD
}

export async function signSession(username) {
  return new jose.SignJWT({ sub: username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(SECRET)
}

export async function verifySession(token) {
  if (!token || typeof token !== 'string') return null
  try {
    const { payload } = await jose.jwtVerify(token, SECRET)
    return payload
  } catch {
    return null
  }
}

export function clearStoredToken() {
  localStorage.removeItem(AUTH_STORAGE_KEY)
}
