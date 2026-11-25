/**
 * Tests for the delete-from-history flow in the WorkflowLayout sidebar switcher.
 *
 * WorkflowLayout has too many dependencies (router, auth context, API calls) to
 * mount directly in unit tests. We test the delete confirmation modal and
 * removeFromHistory integration via a minimal harness that replicates the
 * relevant state machine.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { getRepoHistory, removeFromHistory } from '../../hooks/useAnalysis'

const HISTORY_KEY = 'contribiq_repo_history'

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
vi.stubGlobal('localStorage', lsMock)

function seedHistory(entries: { taskId: string; fullName: string; analyzedAt: string }[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries))
}

type Entry = { taskId: string; fullName: string; analyzedAt: string }

// Harness replicating the delete-row + confirmation modal from WorkflowLayout
function DeleteHarness({
  currentTaskId,
  initialEntries,
  onNavigate,
}: {
  currentTaskId: string
  initialEntries: Entry[]
  onNavigate: (path: string) => void
}) {
  const [history, setHistory] = useState<Entry[]>(initialEntries)
  const [deleteConfirmTaskId, setDeleteConfirmTaskId] = useState<string | null>(null)

  function handleConfirmDelete(taskId: string) {
    const updated = removeFromHistory(taskId)
    setHistory(updated)
    setDeleteConfirmTaskId(null)
    if (taskId === currentTaskId) {
      onNavigate('/dashboard')
    }
  }

  const confirmEntry = deleteConfirmTaskId ? history.find(e => e.taskId === deleteConfirmTaskId) : null

  return (
    <div>
      <ul data-testid="switcher-list">
        {history.map(entry => (
          <li key={entry.taskId} data-testid={`row-${entry.taskId}`}>
            <span>{entry.fullName}</span>
            <button
              data-testid={`delete-${entry.taskId}`}
              aria-label={`Delete ${entry.fullName}`}
              onClick={() => setDeleteConfirmTaskId(entry.taskId)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {deleteConfirmTaskId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-confirm-title"
          data-testid="delete-modal"
          onClick={() => setDeleteConfirmTaskId(null)}
        >
          <div onClick={e => e.stopPropagation()}>
            <h2 id="delete-confirm-title">Remove from history?</h2>
            {confirmEntry && <p data-testid="confirm-repo-name">{confirmEntry.fullName}</p>}
            <button
              data-testid="confirm-remove"
              onClick={() => handleConfirmDelete(deleteConfirmTaskId)}
            >
              Remove
            </button>
            <button data-testid="cancel-delete" onClick={() => setDeleteConfirmTaskId(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const makeEntry = (taskId: string, fullName = `owner/${taskId}`): Entry => ({
  taskId,
  fullName,
  analyzedAt: new Date().toISOString(),
})

describe('Delete-from-history — delete button opens confirmation modal', () => {
  const entries = [makeEntry('t1', 'owner/repo-1'), makeEntry('t2', 'owner/repo-2')]

  beforeEach(() => {
    lsMock.clear()
    seedHistory(entries)
  })

  it('shows the confirmation modal when the delete button is clicked', () => {
    render(<DeleteHarness currentTaskId="t1" initialEntries={entries} onNavigate={vi.fn()} />)
    fireEvent.click(screen.getByTestId('delete-t2'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Remove from history?')).toBeInTheDocument()
  })

  it('shows the repo name inside the confirmation modal', () => {
    render(<DeleteHarness currentTaskId="t1" initialEntries={entries} onNavigate={vi.fn()} />)
    fireEvent.click(screen.getByTestId('delete-t2'))
    expect(screen.getByTestId('confirm-repo-name')).toHaveTextContent('owner/repo-2')
  })

  it('does not show the modal before any delete button is clicked', () => {
    render(<DeleteHarness currentTaskId="t1" initialEntries={entries} onNavigate={vi.fn()} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('Delete-from-history — confirmation modal interactions', () => {
  const entries = [makeEntry('t1', 'owner/repo-1'), makeEntry('t2', 'owner/repo-2')]
  const onNavigate = vi.fn()

  beforeEach(() => {
    lsMock.clear()
    seedHistory(entries)
    onNavigate.mockClear()
  })

  function openDeleteModal(taskIdToDelete: string) {
    render(<DeleteHarness currentTaskId="t1" initialEntries={entries} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByTestId(`delete-${taskIdToDelete}`))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  }

  it('"Cancel" closes the modal without removing the entry', () => {
    openDeleteModal('t2')
    fireEvent.click(screen.getByTestId('cancel-delete'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('row-t2')).toBeInTheDocument()
  })

  it('clicking the overlay backdrop closes the modal without removing the entry', () => {
    openDeleteModal('t2')
    fireEvent.click(screen.getByRole('dialog'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('row-t2')).toBeInTheDocument()
  })

  it('clicking inside the modal card does not close it', () => {
    openDeleteModal('t2')
    fireEvent.click(screen.getByText('Remove from history?'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('"Remove" removes the entry from the rendered list', () => {
    openDeleteModal('t2')
    fireEvent.click(screen.getByTestId('confirm-remove'))
    expect(screen.queryByTestId('row-t2')).not.toBeInTheDocument()
    expect(screen.getByTestId('row-t1')).toBeInTheDocument()
  })

  it('"Remove" closes the confirmation modal', () => {
    openDeleteModal('t2')
    fireEvent.click(screen.getByTestId('confirm-remove'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('"Remove" calls removeFromHistory and persists to localStorage', () => {
    openDeleteModal('t2')
    fireEvent.click(screen.getByTestId('confirm-remove'))
    const remaining = getRepoHistory()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].taskId).toBe('t1')
  })
})

describe('Delete-from-history — navigation when deleting the current repo', () => {
  const onNavigate = vi.fn()

  beforeEach(() => {
    lsMock.clear()
    onNavigate.mockClear()
  })

  it('navigates to /dashboard when the current repo is deleted', () => {
    const entries = [makeEntry('current-task'), makeEntry('other-task')]
    seedHistory(entries)
    render(<DeleteHarness currentTaskId="current-task" initialEntries={entries} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByTestId('delete-current-task'))
    fireEvent.click(screen.getByTestId('confirm-remove'))
    expect(onNavigate).toHaveBeenCalledWith('/dashboard')
  })

  it('does NOT navigate when a non-current repo is deleted', () => {
    const entries = [makeEntry('current-task'), makeEntry('other-task')]
    seedHistory(entries)
    render(<DeleteHarness currentTaskId="current-task" initialEntries={entries} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByTestId('delete-other-task'))
    fireEvent.click(screen.getByTestId('confirm-remove'))
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('still removes the entry from the list even when it is not the current one', () => {
    const entries = [makeEntry('current-task'), makeEntry('other-task')]
    seedHistory(entries)
    render(<DeleteHarness currentTaskId="current-task" initialEntries={entries} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByTestId('delete-other-task'))
    fireEvent.click(screen.getByTestId('confirm-remove'))
    expect(screen.queryByTestId('row-other-task')).not.toBeInTheDocument()
    expect(screen.getByTestId('row-current-task')).toBeInTheDocument()
  })
})
