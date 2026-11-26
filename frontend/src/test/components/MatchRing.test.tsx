/**
 * Tests for MatchRing — SVG ring component showing AI match percentage.
 *
 * Covers: aria-label, percentage text, color thresholds (green ≥75,
 * amber ≥50, gray <50), default and custom size, and boundary values.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import MatchRing from '../../components/MatchRing'

function getStrokeColor(container: HTMLElement): string {
  const circles = container.querySelectorAll('circle')
  // Second circle is the filled arc — it has the dynamic stroke color
  return (circles[1] as SVGCircleElement).getAttribute('stroke') ?? ''
}

// ── accessibility ─────────────────────────────────────────────────────────────

describe('MatchRing — accessibility', () => {
  it('has aria-label showing the percentage', () => {
    render(<MatchRing pct={80} />)
    expect(screen.getByLabelText('80% match')).toBeInTheDocument()
  })

  it('updates aria-label when pct changes', () => {
    const { rerender } = render(<MatchRing pct={40} />)
    expect(screen.getByLabelText('40% match')).toBeInTheDocument()
    rerender(<MatchRing pct={90} />)
    expect(screen.getByLabelText('90% match')).toBeInTheDocument()
  })
})

// ── percentage text ───────────────────────────────────────────────────────────

describe('MatchRing — percentage text', () => {
  it('renders the percentage inside the SVG', () => {
    const { container } = render(<MatchRing pct={65} />)
    expect(container.querySelector('text')?.textContent).toBe('65%')
  })

  it('renders 0% correctly', () => {
    const { container } = render(<MatchRing pct={0} />)
    expect(container.querySelector('text')?.textContent).toBe('0%')
  })

  it('renders 100% correctly', () => {
    const { container } = render(<MatchRing pct={100} />)
    expect(container.querySelector('text')?.textContent).toBe('100%')
  })
})

// ── color thresholds ──────────────────────────────────────────────────────────

describe('MatchRing — color thresholds', () => {
  it('uses green (#3fb950) for pct >= 75', () => {
    const { container } = render(<MatchRing pct={75} />)
    expect(getStrokeColor(container)).toBe('#3fb950')
  })

  it('uses green for pct = 100', () => {
    const { container } = render(<MatchRing pct={100} />)
    expect(getStrokeColor(container)).toBe('#3fb950')
  })

  it('uses amber (#d29922) for pct >= 50 and < 75', () => {
    const { container } = render(<MatchRing pct={50} />)
    expect(getStrokeColor(container)).toBe('#d29922')
  })

  it('uses amber for pct = 74', () => {
    const { container } = render(<MatchRing pct={74} />)
    expect(getStrokeColor(container)).toBe('#d29922')
  })

  it('uses gray (#8b949e) for pct < 50', () => {
    const { container } = render(<MatchRing pct={49} />)
    expect(getStrokeColor(container)).toBe('#8b949e')
  })

  it('uses gray for pct = 0', () => {
    const { container } = render(<MatchRing pct={0} />)
    expect(getStrokeColor(container)).toBe('#8b949e')
  })
})

// ── size prop ─────────────────────────────────────────────────────────────────

describe('MatchRing — size prop', () => {
  it('defaults to size 64', () => {
    const { container } = render(<MatchRing pct={50} />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('width')).toBe('64')
    expect(svg.getAttribute('height')).toBe('64')
  })

  it('renders with a custom size', () => {
    const { container } = render(<MatchRing pct={50} size={96} />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('width')).toBe('96')
    expect(svg.getAttribute('height')).toBe('96')
  })
})
