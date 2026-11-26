/**
 * Tests for DifficultyDots — 5-dot visual indicator for issue difficulty.
 *
 * Covers: always renders 5 dots, correct filled count, aria-label,
 * rounding, and clamping at 0 and 5.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import DifficultyDots from '../../components/DifficultyDots'

const FILLED = { background: '#d29922' }
const EMPTY  = { background: 'rgba(255,255,255,0.12)' }

function getDots(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('span'))
}

function countFilled(container: HTMLElement): number {
  return getDots(container).filter(span => {
    try { expect(span).toHaveStyle(FILLED); return true } catch { return false }
  }).length
}

// ── rendering ─────────────────────────────────────────────────────────────────

describe('DifficultyDots — rendering', () => {
  it('always renders exactly 5 dots', () => {
    const { container } = render(<DifficultyDots score={3} />)
    expect(getDots(container)).toHaveLength(5)
  })

  it('has correct aria-label', () => {
    render(<DifficultyDots score={3} />)
    expect(screen.getByLabelText('Difficulty 3 of 5')).toBeInTheDocument()
  })
})

// ── filled dot count ──────────────────────────────────────────────────────────

describe('DifficultyDots — filled count', () => {
  it('fills 0 dots for score 0', () => {
    const { container } = render(<DifficultyDots score={0} />)
    expect(countFilled(container)).toBe(0)
  })

  it('fills 1 dot for score 1', () => {
    const { container } = render(<DifficultyDots score={1} />)
    expect(countFilled(container)).toBe(1)
  })

  it('fills 3 dots for score 3', () => {
    const { container } = render(<DifficultyDots score={3} />)
    expect(countFilled(container)).toBe(3)
  })

  it('fills all 5 dots for score 5', () => {
    const { container } = render(<DifficultyDots score={5} />)
    expect(countFilled(container)).toBe(5)
  })

  it('unfilled dots use the empty color', () => {
    const { container } = render(<DifficultyDots score={2} />)
    const empty = getDots(container).filter(span => {
      try { expect(span).toHaveStyle(EMPTY); return true } catch { return false }
    })
    expect(empty).toHaveLength(3)
  })
})

// ── rounding ──────────────────────────────────────────────────────────────────

describe('DifficultyDots — rounding', () => {
  it('rounds 2.4 down to 2 filled dots', () => {
    const { container } = render(<DifficultyDots score={2.4} />)
    expect(countFilled(container)).toBe(2)
  })

  it('rounds 2.5 up to 3 filled dots', () => {
    const { container } = render(<DifficultyDots score={2.5} />)
    expect(countFilled(container)).toBe(3)
  })

  it('aria-label reflects the rounded value', () => {
    render(<DifficultyDots score={3.7} />)
    expect(screen.getByLabelText('Difficulty 4 of 5')).toBeInTheDocument()
  })
})

// ── clamping ──────────────────────────────────────────────────────────────────

describe('DifficultyDots — clamping', () => {
  it('clamps score above 5 to 5 filled dots', () => {
    const { container } = render(<DifficultyDots score={10} />)
    expect(countFilled(container)).toBe(5)
  })

  it('clamps score below 0 to 0 filled dots', () => {
    const { container } = render(<DifficultyDots score={-3} />)
    expect(countFilled(container)).toBe(0)
  })
})
