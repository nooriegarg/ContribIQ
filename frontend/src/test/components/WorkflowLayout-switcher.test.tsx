/**
 * Tests for the multi-repo switcher feature added to WorkflowLayout.
 *
 * WorkflowLayout itself depends on React Router, auth context, and API calls,
 * so we test the extracted helper and the popup UI via a minimal React harness
 * that replicates just the gating + switcher state machine.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React, { useState } from 'react'
import { getRepoHistory } from '../../hooks/useAnalysis'

const HISTORY_KEY = 'contribiq_repo_history'

// The test environment may replace localStorage/sessionStorage with minimal stubs
// that lack clear/removeItem. Use in-memory mocks to ensure reliable isolation.
function makeStorageMock() {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
}

const lsMock = makeStorageMock()
const ssMock = makeStorageMock()
vi.stubGlobal('localStorage', lsMock)
vi.stubGlobal('sessionStorage', ssMock)

// ─── isAnalysisReady (sessionStorage-based gate) ──────────────────────────────

function isAnalysisReady(taskId: string) {
  return !!sessionStorage.getItem(`arch-${taskId}`)
}

describe('isAnalysisReady', () => {
  beforeEach(() => {
    ssMock.clear()
  })

  it('returns false when sessionStorage key is absent', () => {
    expect(isAnalysisReady('task-abc')).toBe(false)
  })

  it('returns true when arch-{taskId} key is present', () => {
    sessionStorage.setItem('arch-task-abc', 'some-diagram-data')
    expect(isAnalysisReady('task-abc')).toBe(true)
  })

  it('returns false for a different taskId even when another key exists', () => {
    sessionStorage.setItem('arch-task-123', 'data')
    expect(isAnalysisReady('task-999')).toBe(false)
  })

  it('is unaffected by onboarding-plan-* keys (only arch-* gates switching)', () => {
    sessionStorage.setItem('onboarding-plan-task-abc', 'plan-data')
    expect(isAnalysisReady('task-abc')).toBe(false)
  })
})

// ─── SwitchBlockedPopup (the blocked-modal UI) ────────────────────────────────

function SwitchBlockedPopup({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="switch-block-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="switch-block-title"
      onClick={onClose}
    >
      <div className="switch-block-modal" onClick={e => e.stopPropagation()}>
        <div className="switch-block-icon" aria-hidden="true">⏳</div>
        <h2 className="switch-block-title" id="switch-block-title">Analysis still in progress</h2>
        <p className="switch-block-desc">
          Please wait for the analysis to complete before switching repositories.
        </p>
        <button onClick={onClose} autoFocus>Got it</button>
      </div>
    </div>
  )
}

function SwitcherHarness({
  ready,
  historyEntries,
}: {
  ready: boolean
  historyEntries: { taskId: string; fullName: string }[]
}) {
  const [blocked, setBlocked] = useState(false)
  const [open, setOpen] = useState(false)
  const [navigated, setNavigated] = useState<string | null>(null)

  function handleSwitchAttempt(taskId: string) {
    if (!ready) {
      setOpen(false)
      setBlocked(true)
      return
    }
    setNavigated(taskId)
  }

  function handleNewRepoAttempt(e: React.MouseEvent) {
    if (!ready) {
      e.preventDefault()
      setOpen(false)
      setBlocked(true)
    }
  }

  return (
    <div>
      {historyEntries.length > 1 && (
        <div>
          <button
            data-testid="switcher-btn"
            className={ready ? '' : 'locked'}
            onClick={() => (ready ? setOpen(o => !o) : setBlocked(true))}
          >
            {!ready && <span data-testid="lock-icon">⏳</span>}
            Switch repository
          </button>

          {open && ready && (
            <ul role="listbox">
              {historyEntries.map(entry => (
                <li key={entry.taskId}>
                  <button
                    data-testid={`switch-to-${entry.taskId}`}
                    onClick={() => handleSwitchAttempt(entry.taskId)}
                  >
                    {entry.fullName}
                  </button>
                </li>
              ))}
              <li>
                <a
                  href="/dashboard"
                  data-testid="new-repo-link"
                  onClick={handleNewRepoAttempt}
                >
                  + Analyze new repository
                </a>
              </li>
            </ul>
          )}
        </div>
      )}

      {historyEntries.length <= 1 && (
        <a href="/dashboard" data-testid="analyze-another" onClick={handleNewRepoAttempt}>
          Analyze another repository
        </a>
      )}

      {navigated && <div data-testid="navigated-to">{navigated}</div>}

      {blocked && <SwitchBlockedPopup onClose={() => setBlocked(false)} />}
    </div>
  )
}

describe('Repo switcher — history.length > 1', () => {
  const twoEntries = [
    { taskId: 'task-a', fullName: 'owner/repo-a' },
    { taskId: 'task-b', fullName: 'owner/repo-b' },
  ]

  it('shows the switcher button when history has more than one entry', () => {
    render(<SwitcherHarness ready historyEntries={twoEntries} />)
    expect(screen.getByTestId('switcher-btn')).toBeInTheDocument()
  })

  it('hides the switcher button when history has only one entry', () => {
    render(<SwitcherHarness ready historyEntries={[twoEntries[0]]} />)
    expect(screen.queryByTestId('switcher-btn')).not.toBeInTheDocument()
  })

  it('shows "Analyze another repository" link when history has only one entry', () => {
    render(<SwitcherHarness ready historyEntries={[twoEntries[0]]} />)
    expect(screen.getByTestId('analyze-another')).toBeInTheDocument()
  })
})

describe('Repo switcher — locked state (analysis not ready)', () => {
  const entries = [
    { taskId: 'task-a', fullName: 'owner/repo-a' },
    { taskId: 'task-b', fullName: 'owner/repo-b' },
  ]

  it('adds locked class to switcher button when not ready', () => {
    render(<SwitcherHarness ready={false} historyEntries={entries} />)
    expect(screen.getByTestId('switcher-btn')).toHaveClass('locked')
  })

  it('shows lock icon when not ready', () => {
    render(<SwitcherHarness ready={false} historyEntries={entries} />)
    expect(screen.getByTestId('lock-icon')).toBeInTheDocument()
  })

  it('does not show lock icon when ready', () => {
    render(<SwitcherHarness ready historyEntries={entries} />)
    expect(screen.queryByTestId('lock-icon')).not.toBeInTheDocument()
  })

  it('does not open the dropdown when clicked and not ready', () => {
    render(<SwitcherHarness ready={false} historyEntries={entries} />)
    fireEvent.click(screen.getByTestId('switcher-btn'))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('shows the blocked popup when switcher button clicked while not ready', () => {
    render(<SwitcherHarness ready={false} historyEntries={entries} />)
    fireEvent.click(screen.getByTestId('switcher-btn'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Analysis still in progress')).toBeInTheDocument()
    expect(screen.getByText(/Please wait for the analysis to complete/i)).toBeInTheDocument()
  })
})

describe('Repo switcher — blocked popup interactions', () => {
  const entries = [
    { taskId: 'task-a', fullName: 'owner/repo-a' },
    { taskId: 'task-b', fullName: 'owner/repo-b' },
  ]

  function renderAndOpenPopup() {
    render(<SwitcherHarness ready={false} historyEntries={entries} />)
    fireEvent.click(screen.getByTestId('switcher-btn'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  }

  it('dismisses popup when "Got it" is clicked', () => {
    renderAndOpenPopup()
    fireEvent.click(screen.getByText('Got it'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('dismisses popup when overlay backdrop is clicked', () => {
    renderAndOpenPopup()
    fireEvent.click(screen.getByRole('dialog'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('does not dismiss popup when the modal content area is clicked', () => {
    renderAndOpenPopup()
    fireEvent.click(screen.getByText('Analysis still in progress'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows popup when "Analyze another repository" link is clicked and not ready (single entry)', () => {
    render(<SwitcherHarness ready={false} historyEntries={[entries[0]]} />)
    fireEvent.click(screen.getByTestId('analyze-another'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('Repo switcher — navigation when ready', () => {
  const entries = [
    { taskId: 'task-a', fullName: 'owner/repo-a' },
    { taskId: 'task-b', fullName: 'owner/repo-b' },
  ]

  it('opens the dropdown when clicked and analysis is ready', () => {
    render(<SwitcherHarness ready historyEntries={entries} />)
    fireEvent.click(screen.getByTestId('switcher-btn'))
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })

  it('navigates to the selected repo when analysis is ready', () => {
    render(<SwitcherHarness ready historyEntries={entries} />)
    fireEvent.click(screen.getByTestId('switcher-btn'))
    fireEvent.click(screen.getByTestId('switch-to-task-b'))
    expect(screen.getByTestId('navigated-to')).toHaveTextContent('task-b')
  })

  it('does not show blocked popup when switching while ready', () => {
    render(<SwitcherHarness ready historyEntries={entries} />)
    fireEvent.click(screen.getByTestId('switcher-btn'))
    fireEvent.click(screen.getByTestId('switch-to-task-b'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('Repo switcher — getRepoHistory integration', () => {
  beforeEach(() => {
    lsMock.clear()
    ssMock.clear()
  })

  it('renders switcher button after history has two entries in localStorage', () => {
    const entries = [
      { taskId: 'task-1', fullName: 'o/r1', analyzedAt: new Date().toISOString() },
      { taskId: 'task-2', fullName: 'o/r2', analyzedAt: new Date().toISOString() },
    ]
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries))

    const history = getRepoHistory()
    expect(history).toHaveLength(2)

    // Verify the shape consumed by the switcher
    const displayEntries = history.map(e => ({ taskId: e.taskId, fullName: e.fullName }))
    render(<SwitcherHarness ready historyEntries={displayEntries} />)
    expect(screen.getByTestId('switcher-btn')).toBeInTheDocument()
    expect(screen.queryByTestId('analyze-another')).not.toBeInTheDocument()
  })

  it('switcher is locked when arch-* key is absent for the current taskId', () => {
    const entries = [
      { taskId: 'task-1', fullName: 'o/r1', analyzedAt: new Date().toISOString() },
      { taskId: 'task-2', fullName: 'o/r2', analyzedAt: new Date().toISOString() },
    ]
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries))

    const ready = isAnalysisReady('task-1') // sessionStorage empty → false
    expect(ready).toBe(false)

    const displayEntries = entries.map(e => ({ taskId: e.taskId, fullName: e.fullName }))
    render(<SwitcherHarness ready={ready} historyEntries={displayEntries} />)
    expect(screen.getByTestId('switcher-btn')).toHaveClass('locked')
  })

  it('switcher is unlocked when arch-* key is present', () => {
    sessionStorage.setItem('arch-task-1', 'diagram')
    const entries = [
      { taskId: 'task-1', fullName: 'o/r1', analyzedAt: new Date().toISOString() },
      { taskId: 'task-2', fullName: 'o/r2', analyzedAt: new Date().toISOString() },
    ]
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries))

    const ready = isAnalysisReady('task-1')
    expect(ready).toBe(true)

    const displayEntries = entries.map(e => ({ taskId: e.taskId, fullName: e.fullName }))
    render(<SwitcherHarness ready={ready} historyEntries={displayEntries} />)
    expect(screen.getByTestId('switcher-btn')).not.toHaveClass('locked')
  })
})
