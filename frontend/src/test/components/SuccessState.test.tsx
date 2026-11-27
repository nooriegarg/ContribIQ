/**
 * Tests for SuccessState — static content, bar fill initial width, 3-second
 * redirect timer, and cleanup on unmount.
 *
 * Uses vi.useFakeTimers() to control the setTimeout call without waiting
 * for real time. requestAnimationFrame is implemented in jsdom as setTimeout(0),
 * so advanceTimersByTime covers both RAF and the main redirect timer.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act } from '@testing-library/react'
import SuccessState from '../../components/SuccessState'

afterEach(() => {
  vi.useRealTimers()
})

// ── static content ────────────────────────────────────────────────────────────

describe('SuccessState — static content', () => {
  it('renders "Welcome back!" title', () => {
    const { getByText } = render(<SuccessState onRedirectDone={() => {}} />)
    expect(getByText('Welcome back!')).toBeInTheDocument()
  })

  it('renders the signed-in confirmation text', () => {
    const { getByText } = render(<SuccessState onRedirectDone={() => {}} />)
    expect(getByText(/Signed in successfully/)).toBeInTheDocument()
  })

  it('renders "Redirecting in 3 seconds" hint', () => {
    const { getByText } = render(<SuccessState onRedirectDone={() => {}} />)
    expect(getByText('Redirecting in 3 seconds')).toBeInTheDocument()
  })
})

// ── bar width ─────────────────────────────────────────────────────────────────

describe('SuccessState — progress bar', () => {
  it('bar fill starts at 0% width before animation runs', () => {
    vi.useFakeTimers()
    const { container } = render(<SuccessState onRedirectDone={() => {}} />)
    const fill = container.querySelector('.success-bar-fill') as HTMLElement
    expect(fill.style.width).toBe('0%')
  })

  it('bar fill reaches 100% after animation frames run', () => {
    vi.useFakeTimers()
    const { container } = render(<SuccessState onRedirectDone={() => {}} />)
    act(() => { vi.advanceTimersByTime(100) })
    const fill = container.querySelector('.success-bar-fill') as HTMLElement
    expect(fill.style.width).toBe('100%')
  })
})

// ── redirect timer ────────────────────────────────────────────────────────────

describe('SuccessState — redirect timer', () => {
  it('does not call onRedirectDone before 3000ms', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    render(<SuccessState onRedirectDone={fn} />)
    act(() => { vi.advanceTimersByTime(2999) })
    expect(fn).not.toHaveBeenCalled()
  })

  it('calls onRedirectDone after 3000ms', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    render(<SuccessState onRedirectDone={fn} />)
    act(() => { vi.advanceTimersByTime(3000) })
    expect(fn).toHaveBeenCalledOnce()
  })

  it('does not call onRedirectDone after unmount (timer cancelled)', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const { unmount } = render(<SuccessState onRedirectDone={fn} />)
    unmount()
    act(() => { vi.advanceTimersByTime(3000) })
    expect(fn).not.toHaveBeenCalled()
  })
})
