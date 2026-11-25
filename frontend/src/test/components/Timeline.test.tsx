/**
 * Tests for Timeline — the multi-step onboarding plan component.
 *
 * Covers step state (active / done / locked), the Next Step button advancing
 * through the plan, locked-step hint text, checkmark rendering on completed
 * steps, and sessionStorage persistence when a storageKey is provided.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import Timeline from '../../components/Timeline'
import type { OnboardingStep } from '../../api/onboarding'

function makeSteps(count: number): OnboardingStep[] {
  return Array.from({ length: count }, (_, i) => ({
    step: i + 1,
    title: `Step ${i + 1} Title`,
    description: `Step ${i + 1} description text.`,
    commands: [`echo step-${i + 1}`],
    files_to_read: [{ path: `src/file${i + 1}.ts`, purpose: `File ${i + 1}` }],
  }))
}

function makeStorageMock() {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
}

const ssMock = makeStorageMock()
vi.stubGlobal('sessionStorage', ssMock)

beforeEach(() => {
  ssMock.clear()
})

describe('Timeline — initial render', () => {
  it('renders all step titles', () => {
    render(<Timeline steps={makeSteps(3)} />)
    expect(screen.getByText('Step 1 Title')).toBeInTheDocument()
    expect(screen.getByText('Step 2 Title')).toBeInTheDocument()
    expect(screen.getByText('Step 3 Title')).toBeInTheDocument()
  })

  it('first step is active and shows its description', () => {
    render(<Timeline steps={makeSteps(3)} />)
    expect(screen.getByText('Step 1 description text.')).toBeInTheDocument()
  })

  it('steps after the first are locked and show the unlock hint', () => {
    render(<Timeline steps={makeSteps(3)} />)
    const hints = screen.getAllByText('Complete the previous step to unlock')
    expect(hints).toHaveLength(2)
  })

  it('locked steps do not show their description', () => {
    render(<Timeline steps={makeSteps(3)} />)
    expect(screen.queryByText('Step 2 description text.')).not.toBeInTheDocument()
    expect(screen.queryByText('Step 3 description text.')).not.toBeInTheDocument()
  })

  it('renders step numbers in the dot for each step', () => {
    render(<Timeline steps={makeSteps(3)} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})

describe('Timeline — Next Step navigation', () => {
  it('shows "Next Step" button on the active step when it is not the last', () => {
    render(<Timeline steps={makeSteps(3)} />)
    expect(screen.getByRole('button', { name: /next step/i })).toBeInTheDocument()
  })

  it('does not show "Next Step" on the last step', () => {
    render(<Timeline steps={makeSteps(1)} />)
    expect(screen.queryByRole('button', { name: /next step/i })).not.toBeInTheDocument()
  })

  it('advances to step 2 when "Next Step" is clicked', () => {
    render(<Timeline steps={makeSteps(3)} />)
    fireEvent.click(screen.getByRole('button', { name: /next step/i }))

    // Step 2 is now active — its description becomes visible
    expect(screen.getByText('Step 2 description text.')).toBeInTheDocument()
    // Step 1 is done (not locked) so its description remains visible
    expect(screen.getByText('Step 1 description text.')).toBeInTheDocument()
    // Step 3 is still locked — its description stays hidden
    expect(screen.queryByText('Step 3 description text.')).not.toBeInTheDocument()
  })

  it('shows checkmark for completed step after advancing', () => {
    render(<Timeline steps={makeSteps(3)} />)
    fireEvent.click(screen.getByRole('button', { name: /next step/i }))

    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('advances through all steps in sequence', () => {
    render(<Timeline steps={makeSteps(3)} />)

    fireEvent.click(screen.getByRole('button', { name: /next step/i }))
    fireEvent.click(screen.getByRole('button', { name: /next step/i }))

    expect(screen.getByText('Step 3 description text.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /next step/i })).not.toBeInTheDocument()
  })

  it('previous steps all show checkmarks after advancing to the last step', () => {
    render(<Timeline steps={makeSteps(3)} />)

    fireEvent.click(screen.getByRole('button', { name: /next step/i }))
    fireEvent.click(screen.getByRole('button', { name: /next step/i }))

    const checkmarks = screen.getAllByText('✓')
    expect(checkmarks).toHaveLength(2)
  })
})

describe('Timeline — sessionStorage persistence', () => {
  it('saves current step index when storageKey is provided', () => {
    render(<Timeline steps={makeSteps(3)} storageKey="test-repo" />)
    fireEvent.click(screen.getByRole('button', { name: /next step/i }))

    expect(ssMock.getItem('tl-step-test-repo')).toBe('1')
  })

  it('restores saved step from sessionStorage on mount', () => {
    ssMock.setItem('tl-step-persist-repo', '1')
    render(<Timeline steps={makeSteps(3)} storageKey="persist-repo" />)

    expect(screen.getByText('Step 2 description text.')).toBeInTheDocument()
  })

  it('does not persist step when storageKey is omitted', () => {
    render(<Timeline steps={makeSteps(3)} />)
    fireEvent.click(screen.getByRole('button', { name: /next step/i }))

    expect(ssMock.getItem('tl-step-undefined')).toBeNull()
  })

  it('clamps restored step to valid range if saved value exceeds step count', () => {
    ssMock.setItem('tl-step-oob-repo', '99')
    render(<Timeline steps={makeSteps(2)} storageKey="oob-repo" />)

    expect(screen.getByText('Step 2 description text.')).toBeInTheDocument()
  })
})
