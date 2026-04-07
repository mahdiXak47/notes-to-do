import { useState } from 'react'
import { registerUser, loginWithPassword } from '../../lib/auth.js'
import './Login.css'

export default function Signup({ onSuccess, onGoToLogin }) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    repeatPassword: '',
    acceptTerms: false,
  })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)

  function set(field) {
    return (e) =>
      setForm((prev) => ({
        ...prev,
        [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
      }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.firstName.trim()) return setError('First name is required.')
    if (!form.lastName.trim()) return setError('Last name is required.')
    if (!form.username.trim()) return setError('Username is required.')
    if (!/^[a-zA-Z0-9.]+$/.test(form.username.trim()))
      return setError('Username may only contain letters, numbers, and dots.')
    if (!form.email.trim()) return setError('Email is required.')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      return setError('Enter a valid email address.')
    if (!form.password) return setError('Password is required.')
    if (form.password.length < 8) return setError('Password must be at least 8 characters.')
    if (form.password !== form.repeatPassword) return setError('Passwords do not match.')
    if (!form.acceptTerms) return setError('You must accept the terms and conditions.')

    setBusy(true)
    try {
      await registerUser({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
      })
      await loginWithPassword(form.username.trim(), form.password)
      setShowSuccess(true)
      onSuccess(form.username.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card card border-secondary" style={{ maxWidth: 420 }}>
        <div className="card-body p-4">
          <div className="login-logo mb-3">
            <img
              src="/icons/notes-todo-logo-lockup.svg"
              alt="Notes To-do"
              className="login-logo-img"
            />
          </div>
          <p className="login-subtitle small mb-4">Create your account</p>

          {showSuccess ? (
            <div className="alert alert-success py-2 mb-0" role="status">
              Account created. Loading dashboard…
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {error ? (
                <div className="alert alert-danger py-2 small" role="alert">
                  {error}
                </div>
              ) : null}

              <div className="row g-2 mb-3">
                <div className="col">
                  <label htmlFor="signup-first" className="form-label small mb-1">
                    First name
                  </label>
                  <input
                    id="signup-first"
                    type="text"
                    className="form-control form-control-dark"
                    autoComplete="given-name"
                    value={form.firstName}
                    onChange={set('firstName')}
                    disabled={busy}
                    required
                  />
                </div>
                <div className="col">
                  <label htmlFor="signup-last" className="form-label small mb-1">
                    Last name
                  </label>
                  <input
                    id="signup-last"
                    type="text"
                    className="form-control form-control-dark"
                    autoComplete="family-name"
                    value={form.lastName}
                    onChange={set('lastName')}
                    disabled={busy}
                    required
                  />
                </div>
              </div>

              <div className="mb-3">
                <label htmlFor="signup-user" className="form-label small mb-1">
                  Username
                </label>
                <input
                  id="signup-user"
                  type="text"
                  className="form-control form-control-dark"
                  autoComplete="username"
                  value={form.username}
                  onChange={set('username')}
                  disabled={busy}
                  required
                />
              </div>

              <div className="mb-3">
                <label htmlFor="signup-email" className="form-label small mb-1">
                  Email
                </label>
                <input
                  id="signup-email"
                  type="email"
                  className="form-control form-control-dark"
                  autoComplete="email"
                  value={form.email}
                  onChange={set('email')}
                  disabled={busy}
                  required
                />
              </div>

              <div className="mb-3">
                <label htmlFor="signup-pass" className="form-label small mb-1">
                  Password
                </label>
                <input
                  id="signup-pass"
                  type="password"
                  className="form-control form-control-dark"
                  autoComplete="new-password"
                  value={form.password}
                  onChange={set('password')}
                  disabled={busy}
                  required
                />
              </div>

              <div className="mb-3">
                <label htmlFor="signup-repeat" className="form-label small mb-1">
                  Repeat password
                </label>
                <input
                  id="signup-repeat"
                  type="password"
                  className="form-control form-control-dark"
                  autoComplete="new-password"
                  value={form.repeatPassword}
                  onChange={set('repeatPassword')}
                  disabled={busy}
                  required
                />
              </div>

              <div className="mb-3 form-check">
                <input
                  id="signup-terms"
                  type="checkbox"
                  className="form-check-input"
                  checked={form.acceptTerms}
                  onChange={set('acceptTerms')}
                  disabled={busy}
                />
                <label htmlFor="signup-terms" className="form-check-label small" style={{ color: '#3d5d78' }}>
                  I accept the{' '}
                  <button
                    type="button"
                    className="btn btn-link btn-sm p-0 align-baseline"
                    style={{ color: '#0047ab', textDecoration: 'underline', fontSize: 'inherit' }}
                    onClick={() => setShowTermsModal(true)}
                  >
                    terms and conditions
                  </button>
                </label>
              </div>

              <button
                type="submit"
                className="btn btn-primary w-100 mb-3"
                disabled={busy}
              >
                {busy ? 'Creating account…' : 'Sign up'}
              </button>

              <p className="text-center small mb-0" style={{ color: '#5a7a95' }}>
                Already have an account?{' '}
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 align-baseline"
                  style={{ color: '#0047ab', textDecoration: 'underline' }}
                  onClick={onGoToLogin}
                  disabled={busy}
                >
                  Sign in here
                </button>
              </p>
            </form>
          )}
        </div>
      </div>

      {showTermsModal && (
        <>
          <div
            className="modal-backdrop fade show"
            style={{ zIndex: 1040 }}
            onClick={() => setShowTermsModal(false)}
          />
          <div
            className="modal fade show d-block"
            style={{ zIndex: 1050 }}
            role="dialog"
            aria-modal="true"
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content" style={{ border: '1px solid rgba(0,71,171,0.15)', boxShadow: '0 8px 32px rgba(0,0,80,0.12)' }}>
                <div className="modal-header border-0 pb-0">
                  <h6 className="modal-title" style={{ color: '#050557', fontWeight: 600 }}>
                    Terms and Conditions
                  </h6>
                  <button
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={() => setShowTermsModal(false)}
                  />
                </div>
                <div className="modal-body pt-2" style={{ color: '#3d5d78' }}>
                  There is no Terms and Conditions. not yet!
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
