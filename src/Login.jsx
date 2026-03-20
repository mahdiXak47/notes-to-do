import { useEffect, useRef, useState } from 'react'
import { loginWithPassword } from './auth.js'
import './Login.css'

export default function Login({ onSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const redirectRef = useRef(null)

  useEffect(
    () => () => {
      if (redirectRef.current != null) window.clearTimeout(redirectRef.current)
    },
    [],
  )

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const u = username.trim()
    if (!u) {
      setError('Enter a username.')
      return
    }
    setBusy(true)
    try {
      await loginWithPassword(u, password)
      setShowSuccess(true)
      redirectRef.current = window.setTimeout(() => onSuccess(u), 700)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card card border-secondary">
        <div className="card-body p-4">
          <h1 className="login-title h4 mb-1">Notes &amp; To-do</h1>
          <p className="login-subtitle small mb-4">Sign in to open the vault</p>

          {showSuccess ? (
            <div className="alert alert-success py-2 mb-0" role="status">
              Login succeeded. Loading dashboard…
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {error ? (
                <div className="alert alert-danger py-2 small" role="alert">
                  {error}
                </div>
              ) : null}
              <div className="mb-3">
                <label htmlFor="login-user" className="form-label small mb-1">
                  Username
                </label>
                <input
                  id="login-user"
                  type="text"
                  className="form-control form-control-dark"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={busy}
                  required
                />
              </div>
              <div className="mb-3">
                <label htmlFor="login-pass" className="form-label small mb-1">
                  Password
                </label>
                <input
                  id="login-pass"
                  type="password"
                  className="form-control form-control-dark"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary w-100"
                disabled={busy}
              >
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
