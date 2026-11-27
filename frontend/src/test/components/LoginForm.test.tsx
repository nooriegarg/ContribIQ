/**
 * Tests for LoginForm — static rendering, client-side field validation,
 * error clearing on input change, password visibility toggle, Remember Me
 * toggle, and Forgot Password field validation.
 *
 * All tests use invalid or missing data so handleSubmit returns early before
 * calling loginWithEmail — no fetch mocks required.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AuthProvider } from '../../context/AuthContext'
import LoginForm from '../../components/LoginForm'

function renderForm() {
  const onSuccess = vi.fn()
  const utils = render(
    <AuthProvider>
      <LoginForm onSuccess={onSuccess} />
    </AuthProvider>,
  )
  const submit = utils.container.querySelector<HTMLButtonElement>('[type=submit]')!
  return { ...utils, onSuccess, submit }
}

// ── static rendering ──────────────────────────────────────────────────────────

describe('LoginForm — rendering', () => {
  it('renders "Welcome back" title', () => {
    renderForm()
    expect(screen.getByText('Welcome back')).toBeInTheDocument()
  })

  it('renders sign-in subtitle', () => {
    renderForm()
    expect(screen.getByText(/Sign in to continue/)).toBeInTheDocument()
  })

  it('renders email input', () => {
    renderForm()
    expect(screen.getByLabelText('Email address')).toBeInTheDocument()
  })

  it('renders password input', () => {
    renderForm()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('renders Sign In submit button', () => {
    const { submit } = renderForm()
    expect(submit).toBeInTheDocument()
    expect(submit.textContent).toMatch(/sign in/i)
  })

  it('renders Forgot password button', () => {
    renderForm()
    expect(screen.getByRole('button', { name: /forgot password/i })).toBeInTheDocument()
  })

  it('renders Remember me label', () => {
    renderForm()
    expect(screen.getByText('Remember me')).toBeInTheDocument()
  })
})

// ── email validation ──────────────────────────────────────────────────────────

describe('LoginForm — email validation', () => {
  it('shows "Email address is required." when email is empty on submit', () => {
    const { submit } = renderForm()
    fireEvent.click(submit)
    expect(screen.getByText('Email address is required.')).toBeInTheDocument()
  })

  it('shows "Please enter a valid email address." for malformed email', () => {
    const { submit } = renderForm()
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'not-an-email' } })
    fireEvent.click(submit)
    expect(screen.getByText('Please enter a valid email address.')).toBeInTheDocument()
  })

  it('clears the email error when the user types in the email field', () => {
    const { submit } = renderForm()
    fireEvent.click(submit)
    expect(screen.getByText('Email address is required.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'a' } })
    expect(screen.queryByText('Email address is required.')).not.toBeInTheDocument()
  })
})

// ── password validation ───────────────────────────────────────────────────────

describe('LoginForm — password validation', () => {
  it('shows "Password is required." when password is empty on submit', () => {
    const { submit } = renderForm()
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'user@example.com' } })
    fireEvent.click(submit)
    expect(screen.getByText('Password is required.')).toBeInTheDocument()
  })

  it('shows "Password must be at least 8 characters." for short password', () => {
    const { submit } = renderForm()
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'short' } })
    fireEvent.click(submit)
    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument()
  })

  it('clears the password error when the user types in the password field', () => {
    const { submit } = renderForm()
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'user@example.com' } })
    fireEvent.click(submit)
    expect(screen.getByText('Password is required.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'x' } })
    expect(screen.queryByText('Password is required.')).not.toBeInTheDocument()
  })
})

// ── multiple errors ───────────────────────────────────────────────────────────

describe('LoginForm — multiple validation errors', () => {
  it('shows both email and password errors when both are empty', () => {
    const { submit } = renderForm()
    fireEvent.click(submit)
    expect(screen.getByText('Email address is required.')).toBeInTheDocument()
    expect(screen.getByText('Password is required.')).toBeInTheDocument()
  })
})

// ── password visibility toggle ────────────────────────────────────────────────

describe('LoginForm — password visibility', () => {
  it('password input type is "password" by default', () => {
    renderForm()
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
  })

  it('clicking the toggle reveals the password (type becomes "text")', () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /toggle password visibility/i }))
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text')
  })

  it('clicking the toggle a second time hides the password again', () => {
    renderForm()
    const toggle = screen.getByRole('button', { name: /toggle password visibility/i })
    fireEvent.click(toggle)
    fireEvent.click(toggle)
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
  })
})

// ── remember me ───────────────────────────────────────────────────────────────

describe('LoginForm — remember me', () => {
  it('remember-me row does not have "checked" class initially', () => {
    const { container } = renderForm()
    expect(container.querySelector('.remember')).not.toHaveClass('checked')
  })

  it('clicking the remember-me row adds "checked" class', () => {
    const { container } = renderForm()
    fireEvent.click(container.querySelector('.remember')!)
    expect(container.querySelector('.remember')).toHaveClass('checked')
  })

  it('clicking the remember-me row again removes "checked" class', () => {
    const { container } = renderForm()
    const row = container.querySelector('.remember')!
    fireEvent.click(row)
    fireEvent.click(row)
    expect(row).not.toHaveClass('checked')
  })
})

// ── forgot password field validation ──────────────────────────────────────────

describe('LoginForm — forgot password validation', () => {
  it('shows email error when Forgot Password clicked with empty email', () => {
    renderForm()
    fireEvent.click(screen.getByRole('button', { name: /forgot password/i }))
    expect(screen.getByText('Enter your email above to reset your password.')).toBeInTheDocument()
  })

  it('shows email error when Forgot Password clicked with invalid email', () => {
    renderForm()
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'bad-email' } })
    fireEvent.click(screen.getByRole('button', { name: /forgot password/i }))
    expect(screen.getByText('Enter your email above to reset your password.')).toBeInTheDocument()
  })
})
