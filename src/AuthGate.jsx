import { useEffect, useState } from 'react'
import App from './App.jsx'
import Login from './Login.jsx'
import {
  AUTH_STORAGE_KEY,
  clearStoredToken,
  verifySession,
} from './auth.js'
import './Login.css'

export default function AuthGate() {
  const [phase, setPhase] = useState('checking')
  const [sessionUser, setSessionUser] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const token = localStorage.getItem(AUTH_STORAGE_KEY)
      const payload = token ? await verifySession(token) : null
      if (cancelled) return
      if (payload?.sub) {
        setSessionUser(String(payload.sub))
        setPhase('authed')
      } else {
        if (token) clearStoredToken()
        setPhase('guest')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (phase !== 'authed') return undefined
    const tick = async () => {
      const token = localStorage.getItem(AUTH_STORAGE_KEY)
      const payload = token ? await verifySession(token) : null
      if (!payload?.sub) {
        clearStoredToken()
        setSessionUser(null)
        setPhase('guest')
      }
    }
    const id = window.setInterval(tick, 30_000)
    const onFocus = () => {
      tick()
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') tick()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [phase])

  function handleLoginSuccess(username) {
    setSessionUser(username)
    setPhase('authed')
  }

  function handleLogout() {
    clearStoredToken()
    setSessionUser(null)
    setPhase('guest')
  }

  if (phase === 'checking') {
    return (
      <div
        className="auth-loading d-flex align-items-center justify-content-center"
        style={{ minHeight: '100vh' }}
      >
        <span
          className="spinner-border spinner-border-sm me-2"
          role="status"
          aria-hidden
        />
        Loading…
      </div>
    )
  }

  if (phase === 'guest') {
    return <Login onSuccess={handleLoginSuccess} />
  }

  return (
    <App onLogout={handleLogout} username={sessionUser ?? ''} />
  )
}
