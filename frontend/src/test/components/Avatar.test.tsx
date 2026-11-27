/**
 * Tests for Avatar — image variant vs. initials variant, color hash,
 * size prop, and edge cases (empty name).
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Avatar from '../../components/Avatar'

const COLORS = [
  '#6C4EBD', '#3B82F6', '#10B981', '#F59E0B',
  '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6',
]

// ── image variant ─────────────────────────────────────────────────────────────

describe('Avatar — image variant', () => {
  it('renders an img element when avatarUrl is provided', () => {
    render(<Avatar name="Alice" avatarUrl="https://example.com/alice.png" />)
    expect(screen.getByRole('img')).toBeInTheDocument()
  })

  it('img src matches avatarUrl', () => {
    render(<Avatar name="Alice" avatarUrl="https://example.com/alice.png" />)
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/alice.png')
  })

  it('img alt matches name', () => {
    render(<Avatar name="Bob" avatarUrl="https://example.com/bob.png" />)
    expect(screen.getByRole('img')).toHaveAttribute('alt', 'Bob')
  })

  it('applies default size 36 to img width and height', () => {
    const { container } = render(<Avatar name="Alice" avatarUrl="https://example.com/a.png" />)
    const img = container.querySelector('img') as HTMLImageElement
    expect(img.style.width).toBe('36px')
    expect(img.style.height).toBe('36px')
  })

  it('applies custom size to img width and height', () => {
    const { container } = render(<Avatar name="Alice" avatarUrl="https://example.com/a.png" size={48} />)
    const img = container.querySelector('img') as HTMLImageElement
    expect(img.style.width).toBe('48px')
    expect(img.style.height).toBe('48px')
  })
})

// ── initials variant ──────────────────────────────────────────────────────────

describe('Avatar — initials variant', () => {
  it('renders a span with aria-label equal to name', () => {
    render(<Avatar name="Charlie" />)
    expect(screen.getByLabelText('Charlie')).toBeInTheDocument()
  })

  it('displays uppercased first character as the initial', () => {
    render(<Avatar name="dave" />)
    expect(screen.getByLabelText('dave').textContent).toBe('D')
  })

  it('displays ? when name is empty string', () => {
    render(<Avatar name="" />)
    expect(screen.getByText('?')).toBeInTheDocument()
  })

  it('applies default size 36 to span width and height', () => {
    const { container } = render(<Avatar name="Alice" />)
    const span = container.querySelector('span[aria-label]') as HTMLElement
    expect(span.style.width).toBe('36px')
    expect(span.style.height).toBe('36px')
  })

  it('applies custom size to span width and height', () => {
    const { container } = render(<Avatar name="Alice" size={48} />)
    const span = container.querySelector('span[aria-label]') as HTMLElement
    expect(span.style.width).toBe('48px')
    expect(span.style.height).toBe('48px')
  })

  it('font size is 40% of the size prop', () => {
    // size=40 → fontSize = 40 * 0.4 = 16px
    const { container } = render(<Avatar name="Alice" size={40} />)
    const span = container.querySelector('span[aria-label]') as HTMLElement
    expect(span.style.fontSize).toBe('16px')
  })

  it('background color comes from the COLORS palette (Alice → COLORS[0])', () => {
    const { container } = render(<Avatar name="Alice" />)
    const span = container.querySelector('span[aria-label]') as HTMLElement
    // colorForName('Alice') hashes to index 0 → '#6C4EBD'
    expect(span).toHaveStyle({ background: COLORS[0] })
  })

  it('same name always produces the same background color', () => {
    const { container: c1 } = render(<Avatar name="Alice" />)
    const { container: c2 } = render(<Avatar name="Alice" />)
    const bg1 = (c1.querySelector('span[aria-label]') as HTMLElement).style.background
    const bg2 = (c2.querySelector('span[aria-label]') as HTMLElement).style.background
    expect(bg1).toBe(bg2)
  })

  it('different names produce different background colors', () => {
    // Alice → COLORS[0] '#6C4EBD', Zara → COLORS[6] '#EC4899'
    const { container: c1 } = render(<Avatar name="Alice" />)
    const { container: c2 } = render(<Avatar name="Zara" />)
    const bg1 = (c1.querySelector('span[aria-label]') as HTMLElement).style.background
    const bg2 = (c2.querySelector('span[aria-label]') as HTMLElement).style.background
    expect(bg1).not.toBe(bg2)
  })
})
