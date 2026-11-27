/**
 * Tests for OnboardingSetupPage — multi-step form navigation, canAdvance
 * gating, Back/Next button visibility, step counter, and button text on the
 * final step.
 *
 * The page uses useAuth() and useNavigate(), so it is wrapped in
 * MemoryRouter + AuthProvider. No API calls are made during navigation tests
 * (updateProfile is only called on the final "Go to Dashboard" click, which
 * these tests do not trigger).
 *
 * With no user in localStorage the firstName defaults to 'there'.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import OnboardingSetupPage from '../../pages/OnboardingSetupPage'

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
})

function renderPage() {
  return render(
    <MemoryRouter
      initialEntries={['/onboarding-setup']}
    >
      <AuthProvider>
        <OnboardingSetupPage />
      </AuthProvider>
    </MemoryRouter>,
  )
}

// helpers ─────────────────────────────────────────────────────────────────────

function nextBtn() { return screen.getByRole('button', { name: /next/i }) }
function goToDashboardBtn() { return screen.getByRole('button', { name: /go to dashboard/i }) }

/** Navigate from step 0 to the target step without clicking the final submit. */
function advanceToStep(target: number) {
  // step 0 → 1: select a language to satisfy canAdvance
  if (target >= 1) {
    fireEvent.click(screen.getByRole('button', { name: 'Python' }))
    fireEvent.click(nextBtn())
  }
  // step 1 → 2: experience selector always passes
  if (target >= 2) {
    fireEvent.click(nextBtn())
  }
  // step 2 → 3: select an interest to satisfy canAdvance
  if (target >= 3) {
    fireEvent.click(screen.getByRole('button', { name: 'Backend / API' }))
    fireEvent.click(nextBtn())
  }
}

// ── step 0 — initial state ────────────────────────────────────────────────────

describe('OnboardingSetupPage — step 0 initial state', () => {
  it('shows "Step 1 of 4" counter', () => {
    renderPage()
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument()
  })

  it('shows the languages question', () => {
    renderPage()
    expect(screen.getByText(/Which languages are you comfortable with/)).toBeInTheDocument()
  })

  it('shows the welcome message using firstName "there" when no user is logged in', () => {
    renderPage()
    expect(screen.getByText('Welcome, there!')).toBeInTheDocument()
  })

  it('does not show a Back button at step 0', () => {
    renderPage()
    expect(screen.queryByRole('button', { name: /^back$/i })).not.toBeInTheDocument()
  })

  it('Next button is disabled when no language is selected', () => {
    renderPage()
    expect(nextBtn()).toBeDisabled()
  })

  it('Next button becomes enabled after selecting a language', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Python' }))
    expect(nextBtn()).not.toBeDisabled()
  })

  it('deselecting a language re-disables the Next button', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Python' }))
    fireEvent.click(screen.getByRole('button', { name: 'Python' }))
    expect(nextBtn()).toBeDisabled()
  })
})

// ── step 0 → step 1 navigation ────────────────────────────────────────────────

describe('OnboardingSetupPage — advancing to step 1', () => {
  it('shows "Step 2 of 4" after clicking Next on step 0', () => {
    renderPage()
    advanceToStep(1)
    expect(screen.getByText('Step 2 of 4')).toBeInTheDocument()
  })

  it('shows the experience question at step 1', () => {
    renderPage()
    advanceToStep(1)
    expect(screen.getByText(/open-source contribution experience/)).toBeInTheDocument()
  })

  it('Back button is visible from step 1 onwards', () => {
    renderPage()
    advanceToStep(1)
    expect(screen.getByRole('button', { name: /^back$/i })).toBeInTheDocument()
  })

  it('Next button is enabled at step 1 without any selection (experience always valid)', () => {
    renderPage()
    advanceToStep(1)
    expect(nextBtn()).not.toBeDisabled()
  })

  it('clicking Back from step 1 returns to step 0', () => {
    renderPage()
    advanceToStep(1)
    fireEvent.click(screen.getByRole('button', { name: /^back$/i }))
    expect(screen.getByText('Step 1 of 4')).toBeInTheDocument()
  })

  it('welcome message is NOT shown after leaving step 0', () => {
    renderPage()
    advanceToStep(1)
    expect(screen.queryByText(/Welcome, there!/)).not.toBeInTheDocument()
  })
})

// ── step 2 — interests gating ─────────────────────────────────────────────────

describe('OnboardingSetupPage — step 2 interests gating', () => {
  it('shows "Step 3 of 4" at step 2', () => {
    renderPage()
    advanceToStep(2)
    expect(screen.getByText('Step 3 of 4')).toBeInTheDocument()
  })

  it('shows the interests question at step 2', () => {
    renderPage()
    advanceToStep(2)
    expect(screen.getByText(/What are you interested in working on/)).toBeInTheDocument()
  })

  it('Next button is disabled at step 2 until an interest is selected', () => {
    renderPage()
    advanceToStep(2)
    expect(nextBtn()).toBeDisabled()
  })

  it('Next button is enabled after selecting an interest', () => {
    renderPage()
    advanceToStep(2)
    fireEvent.click(screen.getByRole('button', { name: 'Backend / API' }))
    expect(nextBtn()).not.toBeDisabled()
  })
})

// ── step 3 — final step ───────────────────────────────────────────────────────

describe('OnboardingSetupPage — step 3 final step', () => {
  it('shows "Step 4 of 4" at step 3', () => {
    renderPage()
    advanceToStep(3)
    expect(screen.getByText('Step 4 of 4')).toBeInTheDocument()
  })

  it('shows the time availability question at step 3', () => {
    renderPage()
    advanceToStep(3)
    expect(screen.getByText(/How much time do you have/)).toBeInTheDocument()
  })

  it('Next button text changes to "Go to Dashboard" on the final step', () => {
    renderPage()
    advanceToStep(3)
    expect(goToDashboardBtn()).toBeInTheDocument()
  })

  it('"Skip for now" button is visible only at step 3', () => {
    renderPage()
    expect(screen.queryByRole('button', { name: /skip for now/i })).not.toBeInTheDocument()
    advanceToStep(3)
    expect(screen.getByRole('button', { name: /skip for now/i })).toBeInTheDocument()
  })

  it('time radio buttons are present with all three options', () => {
    renderPage()
    advanceToStep(3)
    expect(screen.getByRole('radiogroup', { name: /time availability/i })).toBeInTheDocument()
    // TIME_OPTIONS labels (no value= attr on inputs, so query by label text)
    expect(screen.getByText('~1 hour')).toBeInTheDocument()
    expect(screen.getByText('2–3 hours')).toBeInTheDocument()
    expect(screen.getByText('Half a day')).toBeInTheDocument()
  })
})

// ── progress pips ─────────────────────────────────────────────────────────────

describe('OnboardingSetupPage — progress indicator', () => {
  it('the first pip has aria-current="step" at step 0', () => {
    renderPage()
    const pips = screen
      .getByLabelText('Setup progress')
      .querySelectorAll('[aria-current="step"]')
    expect(pips).toHaveLength(1)
  })

  it('the second pip has aria-current="step" after advancing to step 1', () => {
    renderPage()
    advanceToStep(1)
    const pips = screen
      .getByLabelText('Setup progress')
      .querySelectorAll('[aria-current="step"]')
    expect(pips).toHaveLength(1)
  })
})
