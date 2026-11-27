/**
 * Tests for SignupForm — static rendering, client-side field validation
 * (name, email, password), error clearing on input change, and password
 * visibility toggle.
 *
 * All tests use invalid or missing data so handleSubmit returns early before
 * calling registerWithEmail — no fetch mocks required.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AuthProvider } from '../../context/AuthContext'
import SignupForm from '../../components/SignupForm'

function renderForm() {
  const onSuccess = vi.fn()
  const utils = render(
    <AuthProvider>
      <SignupForm onSuccess={onSuccess} />
    </AuthProvider>,
  )
  const submit = utils.container.querySelector<HTMLButtonElement>('[type=submit]')!
  return { ...utils, onSuccess, submit }
}

// ── static rendering ──────────────────────────────────────────────────────────

describe('SignupForm — rendering', () => {
  it('renders "Create your account" title', () => {
    renderForm()
    expect(screen.getByText('Create your account')).toBeInTheDocument()
  })

  it('renders sign-up subtitle', () => {
    renderForm()
    expect(screen.getByText(/Start your open-source contribution journey/)).toBeInTheDocument()
  })

  it('renders Full name input', () => {
    renderForm()
    expect(screen.getByLabelText('Full name')).toBeInTheDocument()
  })

  it('renders Email address input', () => {
    renderForm()
    expect(screen.getByLabelText('Email address')).toBeInTheDocument()
  })

  it('renders Password input', () => {
    renderForm()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
  })

  it('renders Create Account submit button', () => {
    const { submit } = renderForm()
    expect(submit).toBeInTheDocument()
    expect(submit.textContent).toMatch(/create account/i)
  })
})

// ── name validation ───────────────────────────────────────────────────────────

describe('SignupForm — name validation', () => {
  it('shows "Name is required." when name is empty on submit', () => {
    const { submit } = renderForm()
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(submit)
    expect(screen.getByText('Name is required.')).toBeInTheDocument()
  })

  it('clears the name error when the user types in the name field', () => {
    const { submit } = renderForm()
    fireEvent.click(submit)
    expect(screen.getByText('Name is required.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'A' } })
    expect(screen.queryByText('Name is required.')).not.toBeInTheDocument()
  })
})

// ── email validation ──────────────────────────────────────────────────────────

describe('SignupForm — email validation', () => {
  it('shows "Email address is required." when email is empty on submit', () => {
    const { submit } = renderForm()
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(submit)
    expect(screen.getByText('Email address is required.')).toBeInTheDocument()
  })

  it('shows "Please enter a valid email address." for malformed email', () => {
    const { submit } = renderForm()
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'not-an-email' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
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

describe('SignupForm — password validation', () => {
  it('shows "Password is required." when password is empty on submit', () => {
    const { submit } = renderForm()
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'alice@example.com' } })
    fireEvent.click(submit)
    expect(screen.getByText('Password is required.')).toBeInTheDocument()
  })

  it('shows "Password must be at least 8 characters." for short password', () => {
    const { submit } = renderForm()
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'alice@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'short' } })
    fireEvent.click(submit)
    expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument()
  })

  it('clears the password error when the user types in the password field', () => {
    const { submit } = renderForm()
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'Alice' } })
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'alice@example.com' } })
    fireEvent.click(submit)
    expect(screen.getByText('Password is required.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'x' } })
    expect(screen.queryByText('Password is required.')).not.toBeInTheDocument()
  })
})

// ── all fields empty ──────────────────────────────────────────────────────────

describe('SignupForm — multiple validation errors', () => {
  it('shows name, email, and password errors when all fields are empty', () => {
    const { submit } = renderForm()
    fireEvent.click(submit)
    expect(screen.getByText('Name is required.')).toBeInTheDocument()
    expect(screen.getByText('Email address is required.')).toBeInTheDocument()
    expect(screen.getByText('Password is required.')).toBeInTheDocument()
  })
})

// ── password visibility toggle ────────────────────────────────────────────────

describe('SignupForm — password visibility', () => {
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
