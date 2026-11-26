/**
 * Tests for ReadinessScore — dimension bars and overall score display.
 *
 * Covers: dimension labels/scores, "Overall Readiness" footer, bar colors
 * (green >=75, amber >=50, gray <50), bar width clamping (0-100%), and
 * overall score color using the same barColor thresholds.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ReadinessScore from '../../components/ReadinessScore'

// Fill divs are uniquely identified by height:100% (track divs use a pixel height)
function getBarFills(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('div')).filter(
    div => div.style.height === '100%',
  )
}

// Span with fontSize 22px holds the overall score value
function getOverallScoreSpan(container: HTMLElement): HTMLElement | null {
  return (
    Array.from(container.querySelectorAll<HTMLElement>('span')).find(
      span => span.style.fontSize === '22px',
    ) ?? null
  )
}

// ── rendering ─────────────────────────────────────────────────────────────────

describe('ReadinessScore — rendering', () => {
  it('renders all dimension labels', () => {
    render(
      <ReadinessScore
        dimensions={[
          { label: 'Code Quality', score: 80 },
          { label: 'Test Coverage', score: 60 },
        ]}
        overall={70}
      />,
    )
    expect(screen.getByText('Code Quality')).toBeInTheDocument()
    expect(screen.getByText('Test Coverage')).toBeInTheDocument()
  })

  it('renders each dimension score with a percent sign', () => {
    render(
      <ReadinessScore
        dimensions={[{ label: 'Complexity', score: 55 }]}
        overall={72}
      />,
    )
    expect(screen.getByText('55%')).toBeInTheDocument()
  })

  it('renders "Overall Readiness" label text', () => {
    render(<ReadinessScore dimensions={[]} overall={72} />)
    expect(screen.getByText('Overall Readiness')).toBeInTheDocument()
  })

  it('renders overall score with a percent sign', () => {
    render(<ReadinessScore dimensions={[]} overall={88} />)
    expect(screen.getByText('88%')).toBeInTheDocument()
  })

  it('renders no fill bars when dimensions is empty', () => {
    const { container } = render(<ReadinessScore dimensions={[]} overall={50} />)
    expect(getBarFills(container)).toHaveLength(0)
  })
})

// ── bar colors ────────────────────────────────────────────────────────────────

describe('ReadinessScore — bar colors', () => {
  it('uses the green color for score >= 75', () => {
    const { container } = render(
      <ReadinessScore dimensions={[{ label: 'A', score: 75 }]} overall={75} />,
    )
    const fill = getBarFills(container)[0]
    expect(fill.style.background).toContain('#3fb950')
  })

  it('uses the green color for score = 100', () => {
    const { container } = render(
      <ReadinessScore dimensions={[{ label: 'A', score: 100 }]} overall={100} />,
    )
    const fill = getBarFills(container)[0]
    expect(fill.style.background).toContain('#3fb950')
  })

  it('uses the amber color (#d29922) for score >= 50 and < 75', () => {
    const { container } = render(
      <ReadinessScore dimensions={[{ label: 'A', score: 50 }]} overall={50} />,
    )
    const fill = getBarFills(container)[0]
    // #d29922 is a plain hex; jsdom normalises it to rgb
    expect(fill).toHaveStyle({ background: '#d29922' })
  })

  it('uses the amber color for score = 74', () => {
    const { container } = render(
      <ReadinessScore dimensions={[{ label: 'A', score: 74 }]} overall={74} />,
    )
    const fill = getBarFills(container)[0]
    expect(fill).toHaveStyle({ background: '#d29922' })
  })

  it('uses the gray color for score < 50', () => {
    const { container } = render(
      <ReadinessScore dimensions={[{ label: 'A', score: 49 }]} overall={49} />,
    )
    const fill = getBarFills(container)[0]
    expect(fill.style.background).toContain('#8b949e')
  })

  it('uses the gray color for score = 0', () => {
    const { container } = render(
      <ReadinessScore dimensions={[{ label: 'A', score: 0 }]} overall={0} />,
    )
    const fill = getBarFills(container)[0]
    expect(fill.style.background).toContain('#8b949e')
  })

  it('uses different colors for green and amber thresholds', () => {
    const { container } = render(
      <ReadinessScore
        dimensions={[
          { label: 'Green', score: 80 },
          { label: 'Amber', score: 60 },
        ]}
        overall={70}
      />,
    )
    const [green, amber] = getBarFills(container)
    expect(green.style.background).not.toBe(amber.style.background)
  })
})

// ── bar widths ────────────────────────────────────────────────────────────────

describe('ReadinessScore — bar widths', () => {
  it('bar width matches the score percentage', () => {
    const { container } = render(
      <ReadinessScore dimensions={[{ label: 'A', score: 60 }]} overall={60} />,
    )
    const fill = getBarFills(container)[0]
    expect(fill.style.width).toBe('60%')
  })

  it('clamps bar width to 100% for scores above 100', () => {
    const { container } = render(
      <ReadinessScore dimensions={[{ label: 'A', score: 120 }]} overall={100} />,
    )
    const fill = getBarFills(container)[0]
    expect(fill.style.width).toBe('100%')
  })

  it('renders a 0% bar for score = 0', () => {
    const { container } = render(
      <ReadinessScore dimensions={[{ label: 'A', score: 0 }]} overall={0} />,
    )
    const fill = getBarFills(container)[0]
    expect(fill.style.width).toBe('0%')
  })

  it('clamps bar width to 0% for negative scores', () => {
    const { container } = render(
      <ReadinessScore dimensions={[{ label: 'A', score: -10 }]} overall={0} />,
    )
    const fill = getBarFills(container)[0]
    expect(fill.style.width).toBe('0%')
  })
})

// ── overall score color ────────────────────────────────────────────────────────

describe('ReadinessScore — overall score color', () => {
  it('overall score uses green color when overall >= 75', () => {
    const { container } = render(<ReadinessScore dimensions={[]} overall={80} />)
    const span = getOverallScoreSpan(container)
    expect(span?.style.color).toContain('#3fb950')
  })

  it('overall score uses gray color when overall < 50', () => {
    const { container } = render(<ReadinessScore dimensions={[]} overall={30} />)
    const span = getOverallScoreSpan(container)
    expect(span?.style.color).toContain('#8b949e')
  })
})
