/**
 * Tests for ExperienceSelector — three-option radio group for OSS experience level.
 *
 * Covers: all options rendered, correct option checked, onChange fired on
 * selection, role/accessibility attributes, and description text presence.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ExperienceSelector from '../../components/ExperienceSelector'

function renderSelector(value = 'beginner', onChange = vi.fn()) {
  return render(<ExperienceSelector value={value} onChange={onChange} />)
}

// ── rendering ─────────────────────────────────────────────────────────────────

describe('ExperienceSelector — rendering', () => {
  it('renders all three experience options', () => {
    renderSelector()
    expect(screen.getByRole('radio', { name: /beginner/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /some experience/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /experienced/i })).toBeInTheDocument()
  })

  it('has radiogroup role with accessible label', () => {
    renderSelector()
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    expect(screen.getByRole('radiogroup')).toHaveAttribute(
      'aria-label',
      'Open-source contribution experience',
    )
  })

  it('shows description text for each option', () => {
    renderSelector()
    expect(screen.getByText('Never contributed before')).toBeInTheDocument()
    expect(screen.getByText('A few PRs merged')).toBeInTheDocument()
    expect(screen.getByText('Regular contributor')).toBeInTheDocument()
  })
})

// ── checked state ─────────────────────────────────────────────────────────────

describe('ExperienceSelector — checked state', () => {
  it('checks the beginner radio when value is beginner', () => {
    renderSelector('beginner')
    expect(screen.getByRole('radio', { name: /beginner/i })).toBeChecked()
  })

  it('checks the some experience radio when value is some', () => {
    renderSelector('some')
    expect(screen.getByRole('radio', { name: /some experience/i })).toBeChecked()
  })

  it('checks the experienced radio when value is experienced', () => {
    renderSelector('experienced')
    expect(screen.getByRole('radio', { name: /experienced/i })).toBeChecked()
  })

  it('does not check other options when one is selected', () => {
    renderSelector('beginner')
    expect(screen.getByRole('radio', { name: /some experience/i })).not.toBeChecked()
    expect(screen.getByRole('radio', { name: /experienced/i })).not.toBeChecked()
  })
})

// ── onChange ──────────────────────────────────────────────────────────────────

describe('ExperienceSelector — onChange', () => {
  it('calls onChange with "some" when that option is selected', () => {
    const onChange = vi.fn()
    renderSelector('beginner', onChange)
    fireEvent.click(screen.getByRole('radio', { name: /some experience/i }))
    expect(onChange).toHaveBeenCalledWith('some')
  })

  it('calls onChange with "experienced" when that option is selected', () => {
    const onChange = vi.fn()
    renderSelector('beginner', onChange)
    fireEvent.click(screen.getByRole('radio', { name: /experienced/i }))
    expect(onChange).toHaveBeenCalledWith('experienced')
  })

  it('calls onChange with "beginner" when that option is selected', () => {
    const onChange = vi.fn()
    renderSelector('experienced', onChange)
    fireEvent.click(screen.getByRole('radio', { name: /beginner/i }))
    expect(onChange).toHaveBeenCalledWith('beginner')
  })

  it('calls onChange exactly once per click', () => {
    const onChange = vi.fn()
    renderSelector('beginner', onChange)
    fireEvent.click(screen.getByRole('radio', { name: /some experience/i }))
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})
