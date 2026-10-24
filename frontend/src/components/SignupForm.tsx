import { useState } from 'react'
import Alert from './Alert'
import GitHubButton from './GitHubButton'
import { getGitHubOAuthUrl } from '../api/auth'
import { validateEmail } from '../utils/validation'

interface Props {
  onSwitchToLogin: () => void
}

type AlertState = { message: string; variant: 'error' | 'info' | 'success' } | null

export default function SignupForm({ onSwitchToLogin }: Props) {
  const [name, setName]         = useState('')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [showPwd, setShowPwd]   = useState(false)
  const [loading, setLoading]   = useState(false)
  const [alert, setAlert]       = useState<AlertState>(null)
  const [nameError, setNameError]   = useState('')
  const [emailError, setEmailError] = useState('')
  const [pwdError, setPwdError]     = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setNameError(''); setEmailError(''); setPwdError(''); setAlert(null)

    let valid = true
    if (!name.trim()) { setNameError('Name is required.'); valid = false }
    if (!email.trim()) { setEmailError('Email address is required.'); valid = false }
    else if (!validateEmail(email)) { setEmailError('Please enter a valid email address.'); valid = false }
    if (!password) { setPwdError('Password is required.'); valid = false }
    else if (password.length < 8) { setPwdError('Password must be at least 8 characters.'); valid = false }
    if (!valid) return

    setLoading(true)
    await new Promise(r => setTimeout(r, 1200))
    setLoading(false)
    setAlert({ message: 'Account creation is coming soon. Try GitHub login for now.', variant: 'info' })
  }

  function handleGitHubClick() {
    window.location.href = getGitHubOAuthUrl()
  }

  return (
    <div id="form-area">
      <div className="card-head">
        <div className="card-title">Create your account</div>
        <div className="card-sub">Start your open-source contribution journey</div>
      </div>

      <GitHubButton loading={loading} onGitHubClick={handleGitHubClick} />

      <div className="divider">
        <div className="divider-line" />
        <div className="divider-text">or sign up with email</div>
        <div className="divider-line" />
      </div>

      {alert && <Alert message={alert.message} variant={alert.variant} />}

      <form onSubmit={handleSubmit} noValidate>
        {/* Name */}
        <div className="form-group">
          <label className="form-label" htmlFor="name">Full name</label>
          <div className="input-wrap">
            <div className="input-icon">
              <svg viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              className={`form-input${nameError ? ' error' : ''}`}
              type="text"
              id="name"
              name="name"
              placeholder="Your name"
              autoComplete="name"
              value={name}
              onChange={e => { setName(e.target.value); setNameError('') }}
            />
          </div>
          {nameError && (
            <div className="field-error">
              <svg viewBox="0 0 12 12"><path fillRule="evenodd" d="M6 1a5 5 0 100 10A5 5 0 006 1zm-.5 2.5a.5.5 0 011 0v3a.5.5 0 01-1 0V3.5zm.5 5a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" /></svg>
              <span>{nameError}</span>
            </div>
          )}
        </div>

        {/* Email */}
        <div className="form-group">
          <label className="form-label" htmlFor="signup-email">Email address</label>
          <div className="input-wrap">
            <div className="input-icon">
              <svg viewBox="0 0 20 20">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
            </div>
            <input
              className={`form-input${emailError ? ' error' : ''}`}
              type="email"
              id="signup-email"
              name="email"
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setEmailError(''); setAlert(null) }}
            />
          </div>
          {emailError && (
            <div className="field-error">
              <svg viewBox="0 0 12 12"><path fillRule="evenodd" d="M6 1a5 5 0 100 10A5 5 0 006 1zm-.5 2.5a.5.5 0 011 0v3a.5.5 0 01-1 0V3.5zm.5 5a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" /></svg>
              <span>{emailError}</span>
            </div>
          )}
        </div>

        {/* Password */}
        <div className="form-group">
          <label className="form-label" htmlFor="signup-password">Password</label>
          <div className="input-wrap">
            <div className="input-icon">
              <svg viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              className={`form-input${pwdError ? ' error' : ''}`}
              type={showPwd ? 'text' : 'password'}
              id="signup-password"
              name="password"
              placeholder="Min. 8 characters"
              autoComplete="new-password"
              value={password}
              onChange={e => { setPassword(e.target.value); setPwdError(''); setAlert(null) }}
            />
            <button className="pwd-toggle" type="button" aria-label="Toggle password visibility" onClick={() => setShowPwd(v => !v)}>
              {showPwd ? (
                <svg viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                  <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.064 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                </svg>
              ) : (
                <svg viewBox="0 0 20 20">
                  <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                  <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          </div>
          {pwdError && (
            <div className="field-error">
              <svg viewBox="0 0 12 12"><path fillRule="evenodd" d="M6 1a5 5 0 100 10A5 5 0 006 1zm-.5 2.5a.5.5 0 011 0v3a.5.5 0 01-1 0V3.5zm.5 5a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" /></svg>
              <span>{pwdError}</span>
            </div>
          )}
        </div>

        <button className="btn-submit" type="submit" disabled={loading}>
          {loading ? (
            <div className="spinner" />
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg viewBox="0 0 20 20">
                <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
              </svg>
              Create Account
            </span>
          )}
        </button>
      </form>
    </div>
  )
}
