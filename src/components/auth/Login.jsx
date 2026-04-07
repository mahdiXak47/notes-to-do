import { useState } from 'react'
import { loginWithPassword } from '../../lib/auth.js'
import './Login.css'

export default function Login({ onSuccess, onGoToSignup }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

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
      onSuccess(u)
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
          <div className="login-logo mb-3">
            <img
              src="/icons/notes-todo-logo-lockup.svg"
              alt="Notes To-do"
              className="login-logo-img"
            />
          </div>
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
                className="btn btn-primary w-100 mb-3"
                disabled={busy}
              >
                {busy ? 'Signing in…' : 'Sign in'}
              </button>

              <p className="text-center small mb-0" style={{ color: '#5a7a95' }}>
                Not registered yet?{' '}
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 align-baseline"
                  style={{ color: '#0047ab', textDecoration: 'underline' }}
                  onClick={onGoToSignup}
                  disabled={busy}
                >
                  Sign up here
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
