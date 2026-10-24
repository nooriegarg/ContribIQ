import { useState } from 'react'
import Alert from './Alert'
import GitHubButton from './GitHubButton'
import { loginWithEmail, requestPasswordReset, getGitHubOAuthUrl } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { validateEmail } from '../utils/validation'

interface Props {
  onSuccess: () => void
}

type AlertState = { message: string; variant: 'error' | 'info' | 'success' } | null

export default function LoginForm({ onSuccess }: Props) {
  const { login } = useAuth()

  const [email, setEmail]           = useState('')
  const [password, setPassword]     = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [showPwd, setShowPwd]       = useState(false)
  const [loading, setLoading]       = useState(false)
  const [alert, setAlert]           = useState<AlertState>(null)
  const [emailError, setEmailError] = useState('')
  const [pwdError, setPwdError]     = useState('')

  function clearFieldErrors() {
    setEmailError('')
    setPwdError('')
    setAlert(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    clearFieldErrors()

    let valid = true
    if (!email.trim()) {
      setEmailError('Email address is required.')
      valid = false
    } else if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address.')
      valid = false
    }
    if (!password) {
      setPwdError('Password is required.')
      valid = false
    } else if (password.length < 8) {
      setPwdError('Password must be at least 8 characters.')
      valid = false
    }
    if (!valid) return

    setLoading(true)
    try {
      const data = await loginWithEmail({ email: email.trim(), password, rememberMe })
      login(data.token, data.user, rememberMe)
      onSuccess()
    } catch (err) {
      setAlert({ message: (err as Error).message || 'Invalid email or password.', variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  async function handleForgotPassword() {
    if (!email.trim() || !validateEmail(email)) {
      setEmailError('Enter your email above to reset your password.')
      return
    }
    try {
      await requestPasswordReset(email.trim())
      setAlert({ message: `Reset link sent to ${email.trim()}. Check your inbox.`, variant: 'success' })
    } catch {
      setAlert({ message: 'Could not send reset email. Please try again.', variant: 'error' })
    }
  }

  function handleGitHubClick() {
    window.location.href = getGitHubOAuthUrl()
  }

  return (
    <div id="form-area">
      <div className="card-head">
        <div className="card-title">Welcome back</div>
        <div className="card-sub">Sign in to continue your contribution journey</div>
      </div>

      <GitHubButton loading={loading} onGitHubClick={handleGitHubClick} />

      <div className="divider">
        <div className="divider-line" />
        <div className="divider-text">or sign in with email</div>
        <div className="divider-line" />
      </div>

      {alert && <Alert message={alert.message} variant={alert.variant} />}

      <form onSubmit={handleSubmit} noValidate>
        {/* Email */}
        <div className="form-group">
          <label className="form-label" htmlFor="email">Email address</label>
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
              id="email"
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
              <svg viewBox="0 0 12 12">
                <path fillRule="evenodd" d="M6 1a5 5 0 100 10A5 5 0 006 1zm-.5 2.5a.5.5 0 011 0v3a.5.5 0 01-1 0V3.5zm.5 5a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
              </svg>
              <span>{emailError}</span>
            </div>
          )}
        </div>

        {/* Password */}
        <div className="form-group">
          <label className="form-label" htmlFor="password">Password</label>
          <div className="input-wrap">
            <div className="input-icon">
              <svg viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              className={`form-input${pwdError ? ' error' : ''}`}
              type={showPwd ? 'text' : 'password'}
              id="password"
              name="password"
              placeholder="Enter your password"
              autoComplete="current-password"
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
              <svg viewBox="0 0 12 12">
                <path fillRule="evenodd" d="M6 1a5 5 0 100 10A5 5 0 006 1zm-.5 2.5a.5.5 0 011 0v3a.5.5 0 01-1 0V3.5zm.5 5a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
              </svg>
              <span>{pwdError}</span>
            </div>
          )}
        </div>

        {/* Remember + Forgot */}
        <div className="row-extras">
          <div className={`remember${rememberMe ? ' checked' : ''}`} onClick={() => setRememberMe(v => !v)}>
            <div className="remember-box">
              <svg viewBox="0 0 9 9">
                <path d="M1 4.5l2.5 2.5 5-5" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <label className="remember-label" onClick={e => e.preventDefault()}>Remember me</label>
          </div>
          <button type="button" className="forgot-link" onClick={handleForgotPassword}>
            Forgot password?
          </button>
        </div>

        {/* Submit */}
        <button className="btn-submit" type="submit" disabled={loading}>
          {loading ? (
            <div className="spinner" />
          ) : (
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 3a1 1 0 011 1v12a1 1 0 11-2 0V4a1 1 0 011-1zm7.707 3.293a1 1 0 010 1.414L9.414 9H17a1 1 0 110 2H9.414l1.293 1.293a1 1 0 01-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Sign In
            </span>
          )}
        </button>
      </form>
    </div>
  )
}
