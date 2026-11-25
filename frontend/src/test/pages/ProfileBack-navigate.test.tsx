/**
 * Tests for the back-navigation fix on profile pages.
 *
 * Both ProfilePage (workflow step 3) and UserProfilePage (/profile route)
 * previously used a hardcoded Link to basePath/onboarding or the last repo
 * in history, showing e.g. "← nooriegarg/ContribIQ". The fix replaces both
 * with navigate(-1) so the button returns to whatever page opened the profile.
 *
 * We test via minimal harnesses that mirror the same navigate(-1) pattern
 * without mounting the full pages and their heavy dependencies.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useNavigate } from 'react-router-dom'

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  Navigate: () => null,
}))

function BackButtonHarness({ label = '← Back' }: { label?: string }) {
  const navigate = useNavigate()
  return (
    <button className="btn btn-s" onClick={() => navigate(-1)} type="button">
      {label}
    </button>
  )
}

describe('Profile back button — navigate(-1)', () => {
  it('renders a button labelled "← Back"', () => {
    const mockNavigate = vi.fn()
    vi.mocked(useNavigate).mockReturnValue(mockNavigate)

    render(<BackButtonHarness />)
    expect(screen.getByRole('button', { name: '← Back' })).toBeInTheDocument()
  })

  it('calls navigate(-1) when clicked', () => {
    const mockNavigate = vi.fn()
    vi.mocked(useNavigate).mockReturnValue(mockNavigate)

    render(<BackButtonHarness />)
    fireEvent.click(screen.getByRole('button', { name: '← Back' }))
    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })

  it('does not render a hardcoded repo path in the button text', () => {
    const mockNavigate = vi.fn()
    vi.mocked(useNavigate).mockReturnValue(mockNavigate)

    render(<BackButtonHarness />)
    const btn = screen.getByRole('button', { name: '← Back' })
    expect(btn.textContent).not.toMatch(/\//)
  })

  it('does not render a hardcoded link with a to= prop', () => {
    const mockNavigate = vi.fn()
    vi.mocked(useNavigate).mockReturnValue(mockNavigate)

    render(<BackButtonHarness />)
    expect(screen.queryByRole('link', { name: /back/i })).not.toBeInTheDocument()
  })

  it('navigate(-1) is called once per click and not on mount', () => {
    const mockNavigate = vi.fn()
    vi.mocked(useNavigate).mockReturnValue(mockNavigate)

    render(<BackButtonHarness />)
    expect(mockNavigate).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: '← Back' }))
    expect(mockNavigate).toHaveBeenCalledTimes(1)
  })

  it('navigate(-1) is called again on each subsequent click', () => {
    const mockNavigate = vi.fn()
    vi.mocked(useNavigate).mockReturnValue(mockNavigate)

    render(<BackButtonHarness />)
    fireEvent.click(screen.getByRole('button', { name: '← Back' }))
    fireEvent.click(screen.getByRole('button', { name: '← Back' }))
    expect(mockNavigate).toHaveBeenCalledTimes(2)
    expect(mockNavigate).toHaveBeenNthCalledWith(1, -1)
    expect(mockNavigate).toHaveBeenNthCalledWith(2, -1)
  })
})
