/**
 * Tests for ChipSelector — multi-select chip component used in profile forms.
 *
 * Covers: preset option toggle, aria-pressed state, checkmark rendering,
 * custom chip add (button click / Enter / comma key), duplicate prevention,
 * custom chip removal, Add button disabled state, and seeding custom values
 * from an initial `selected` list.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ChipSelector from '../../components/ChipSelector'

const OPTIONS = [
  { value: 'python', label: 'Python' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'rust', label: 'Rust' },
]

function renderChips(
  selected: string[] = [],
  onChange = vi.fn(),
  allowCustom = false,
) {
  return render(
    <ChipSelector
      label="Languages"
      options={OPTIONS}
      selected={selected}
      onChange={onChange}
      allowCustom={allowCustom}
    />,
  )
}

// ── preset options ────────────────────────────────────────────────────────────

describe('ChipSelector — preset options', () => {
  it('renders all preset options as buttons', () => {
    renderChips()
    expect(screen.getByRole('button', { name: /python/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /typescript/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /rust/i })).toBeInTheDocument()
  })

  it('unselected chip has aria-pressed false', () => {
    renderChips([])
    expect(screen.getByRole('button', { name: /python/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('selected chip has aria-pressed true', () => {
    renderChips(['python'])
    expect(screen.getByRole('button', { name: /python/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('selected chip shows checkmark', () => {
    renderChips(['typescript'])
    const btn = screen.getByRole('button', { name: /typescript/i })
    expect(btn.textContent).toContain('✓')
  })

  it('unselected chip does not show checkmark', () => {
    renderChips(['typescript'])
    const btn = screen.getByRole('button', { name: /python/i })
    expect(btn.textContent).not.toContain('✓')
  })

  it('clicking an unselected chip calls onChange with its value', () => {
    const onChange = vi.fn()
    renderChips([], onChange)
    fireEvent.click(screen.getByRole('button', { name: /python/i }))
    expect(onChange).toHaveBeenCalledWith('python')
  })

  it('clicking a selected chip calls onChange to deselect it', () => {
    const onChange = vi.fn()
    renderChips(['rust'], onChange)
    fireEvent.click(screen.getByRole('button', { name: /rust/i }))
    expect(onChange).toHaveBeenCalledWith('rust')
  })

  it('selection is case-insensitive', () => {
    renderChips(['PYTHON'])
    expect(screen.getByRole('button', { name: /python/i })).toHaveAttribute('aria-pressed', 'true')
  })
})

// ── custom chips disabled ─────────────────────────────────────────────────────

describe('ChipSelector — allowCustom=false', () => {
  it('does not render the custom input when allowCustom is false', () => {
    renderChips([], vi.fn(), false)
    expect(screen.queryByPlaceholderText(/add custom/i)).not.toBeInTheDocument()
  })
})

// ── custom chips enabled ──────────────────────────────────────────────────────

describe('ChipSelector — allowCustom=true', () => {
  it('renders the custom input and Add button', () => {
    renderChips([], vi.fn(), true)
    expect(screen.getByPlaceholderText(/add custom/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^add$/i })).toBeInTheDocument()
  })

  it('Add button is disabled when input is empty', () => {
    renderChips([], vi.fn(), true)
    expect(screen.getByRole('button', { name: /^add$/i })).toBeDisabled()
  })

  it('Add button is enabled once the user types something', () => {
    renderChips([], vi.fn(), true)
    fireEvent.change(screen.getByPlaceholderText(/add custom/i), { target: { value: 'Go' } })
    expect(screen.getByRole('button', { name: /^add$/i })).toBeEnabled()
  })

  it('clicking Add creates a new chip and calls onChange', () => {
    const onChange = vi.fn()
    renderChips([], onChange, true)
    fireEvent.change(screen.getByPlaceholderText(/add custom/i), { target: { value: 'Go' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    expect(screen.getByRole('button', { name: /go/i })).toBeInTheDocument()
    expect(onChange).toHaveBeenCalledWith('Go')
  })

  it('pressing Enter in the input adds the chip', () => {
    const onChange = vi.fn()
    renderChips([], onChange, true)
    const input = screen.getByPlaceholderText(/add custom/i)
    fireEvent.change(input, { target: { value: 'Elixir' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('Elixir')
  })

  it('pressing comma in the input adds the chip', () => {
    const onChange = vi.fn()
    renderChips([], onChange, true)
    const input = screen.getByPlaceholderText(/add custom/i)
    fireEvent.change(input, { target: { value: 'Kotlin' } })
    fireEvent.keyDown(input, { key: ',' })
    expect(onChange).toHaveBeenCalledWith('Kotlin')
  })

  it('clears the input after adding a chip', () => {
    renderChips([], vi.fn(), true)
    const input = screen.getByPlaceholderText(/add custom/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Scala' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    expect(input.value).toBe('')
  })

  it('does not add a duplicate custom chip', () => {
    const onChange = vi.fn()
    renderChips([], onChange, true)
    const input = screen.getByPlaceholderText(/add custom/i)
    fireEvent.change(input, { target: { value: 'Go' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    fireEvent.change(input, { target: { value: 'Go' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('does not add a chip that matches a preset option', () => {
    const onChange = vi.fn()
    renderChips([], onChange, true)
    const input = screen.getByPlaceholderText(/add custom/i)
    fireEvent.change(input, { target: { value: 'python' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows remove button on custom chip', () => {
    renderChips([], vi.fn(), true)
    fireEvent.change(screen.getByPlaceholderText(/add custom/i), { target: { value: 'Haskell' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    expect(screen.getByLabelText(/remove haskell/i)).toBeInTheDocument()
  })

  it('clicking remove deletes the custom chip', () => {
    renderChips([], vi.fn(), true)
    const input = screen.getByPlaceholderText(/add custom/i)
    fireEvent.change(input, { target: { value: 'Haskell' } })
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }))
    fireEvent.click(screen.getByLabelText(/remove haskell/i))
    expect(screen.queryByRole('button', { name: /haskell/i })).not.toBeInTheDocument()
  })

  it('seeds custom chips from initial selected values not in preset options', () => {
    renderChips(['python', 'Haskell'], vi.fn(), true)
    expect(screen.getByRole('button', { name: /haskell/i })).toBeInTheDocument()
  })
})
