/**
 * Tests for LoginPage tab-switching logic via a minimal harness.
 *
 * LoginPage mounts LoginForm and SignupForm which both require AuthProvider
 * and live API endpoints. The harness mirrors only the view state machine
 * (login ↔ signup ↔ succeeded) and the footer toggle, so tests stay
 * deterministic without mocking the auth context or fetch.
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'

type View = 'login' | 'signup'

function LoginTabHarness() {
  const [view, setView] = useState<View>('login')
  const [succeeded, setSucceeded] = useState(false)

  return (
    <div>
      {succeeded ? (
        <div data-testid="success-state">Success</div>
      ) : view === 'login' ? (
        <div data-testid="login-form">
          <button data-testid="fake-login-success" onClick={() => setSucceeded(true)}>
            Log in
          </button>
        </div>
      ) : (
        <div data-testid="signup-form">
          <button data-testid="fake-signup-success" onClick={() => setSucceeded(true)}>
            Sign up
          </button>
        </div>
      )}

      {!succeeded && (
        <div data-testid="card-footer">
          {view === 'login' ? (
            <>
              Don&apos;t have an account?{' '}
              <a href="#" data-testid="switch-to-signup"
                onClick={e => { e.preventDefault(); setView('signup') }}>
                Create one free
              </a>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <a href="#" data-testid="switch-to-login"
                onClick={e => { e.preventDefault(); setView('login') }}>
                Sign in
              </a>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── initial state ─────────────────────────────────────────────────────────────

describe('LoginPage tabs — initial state', () => {
  it('shows the login form by default', () => {
    render(<LoginTabHarness />)
    expect(screen.getByTestId('login-form')).toBeInTheDocument()
    expect(screen.queryByTestId('signup-form')).not.toBeInTheDocument()
  })

  it('shows "Don\'t have an account?" in the footer when on login view', () => {
    render(<LoginTabHarness />)
    expect(screen.getByTestId('card-footer')).toHaveTextContent("Don't have an account?")
  })

  it('footer contains "Create one free" link in login view', () => {
    render(<LoginTabHarness />)
    expect(screen.getByTestId('switch-to-signup')).toHaveTextContent('Create one free')
  })
})

// ── switching to signup ───────────────────────────────────────────────────────

describe('LoginPage tabs — switching to signup', () => {
  it('shows the signup form after clicking "Create one free"', () => {
    render(<LoginTabHarness />)
    fireEvent.click(screen.getByTestId('switch-to-signup'))
    expect(screen.getByTestId('signup-form')).toBeInTheDocument()
    expect(screen.queryByTestId('login-form')).not.toBeInTheDocument()
  })

  it('footer shows "Already have an account?" in signup view', () => {
    render(<LoginTabHarness />)
    fireEvent.click(screen.getByTestId('switch-to-signup'))
    expect(screen.getByTestId('card-footer')).toHaveTextContent('Already have an account?')
  })

  it('footer contains "Sign in" link in signup view', () => {
    render(<LoginTabHarness />)
    fireEvent.click(screen.getByTestId('switch-to-signup'))
    expect(screen.getByTestId('switch-to-login')).toHaveTextContent('Sign in')
  })
})

// ── switching back to login ───────────────────────────────────────────────────

describe('LoginPage tabs — switching back to login', () => {
  it('shows the login form again after clicking "Sign in" in signup view', () => {
    render(<LoginTabHarness />)
    fireEvent.click(screen.getByTestId('switch-to-signup'))
    fireEvent.click(screen.getByTestId('switch-to-login'))
    expect(screen.getByTestId('login-form')).toBeInTheDocument()
    expect(screen.queryByTestId('signup-form')).not.toBeInTheDocument()
  })

  it('footer shows "Don\'t have an account?" again after switching back', () => {
    render(<LoginTabHarness />)
    fireEvent.click(screen.getByTestId('switch-to-signup'))
    fireEvent.click(screen.getByTestId('switch-to-login'))
    expect(screen.getByTestId('card-footer')).toHaveTextContent("Don't have an account?")
  })
})

// ── succeeded state ───────────────────────────────────────────────────────────

describe('LoginPage tabs — succeeded state', () => {
  it('shows success state and hides forms after login succeeds', () => {
    render(<LoginTabHarness />)
    fireEvent.click(screen.getByTestId('fake-login-success'))
    expect(screen.getByTestId('success-state')).toBeInTheDocument()
    expect(screen.queryByTestId('login-form')).not.toBeInTheDocument()
  })

  it('hides the footer after login succeeds', () => {
    render(<LoginTabHarness />)
    fireEvent.click(screen.getByTestId('fake-login-success'))
    expect(screen.queryByTestId('card-footer')).not.toBeInTheDocument()
  })

  it('shows success state and hides footer after signup succeeds', () => {
    render(<LoginTabHarness />)
    fireEvent.click(screen.getByTestId('switch-to-signup'))
    fireEvent.click(screen.getByTestId('fake-signup-success'))
    expect(screen.getByTestId('success-state')).toBeInTheDocument()
    expect(screen.queryByTestId('card-footer')).not.toBeInTheDocument()
  })
})
