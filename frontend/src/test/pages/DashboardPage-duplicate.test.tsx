/**
 * Tests for the duplicate-repo detection modal on DashboardPage.
 *
 * DashboardPage depends on React Router, auth context, and useAnalysis.
 * We test the duplicate-detection logic via a minimal harness that mirrors
 * the same state machine (getRepoHistory lookup + existingEntry state) without
 * mounting the full page and its transitive dependencies.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React, { useState } from 'react'
import { getRepoHistory } from '../../hooks/useAnalysis'
import { parseGitHubRepository } from '../../utils/validation'

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

// Harness replicating the duplicate-detection logic and modal from DashboardPage
interface ExistingEntry { taskId: string; fullName: string; analyzedAt: string }

function DuplicateDetectionHarness({
  onAnalyzeNew,
}: {
  onAnalyzeNew: (owner: string, repo: string) => void
}) {
  const [repoInput, setRepoInput] = useState('')
  const [inputError, setInputError] = useState('')
  const [existingEntry, setExistingEntry] = useState<ExistingEntry | null>(null)
  const [navigatedTo, setNavigatedTo] = useState<string | null>(null)
  const [analyzeAgainCalled, setAnalyzeAgainCalled] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseGitHubRepository(repoInput)
    if (!parsed) {
      setInputError('Invalid repository')
      return
    }
    setInputError('')
    const fullName = `${parsed.owner}/${parsed.repo}`
    const history = getRepoHistory()
    const found = history.find(h => h.fullName.toLowerCase() === fullName.toLowerCase())
    if (found) {
      setExistingEntry(found)
      return
    }
    onAnalyzeNew(parsed.owner, parsed.repo)
  }

  function handleAnalyzeAnyway() {
    setExistingEntry(null)
    const parsed = parseGitHubRepository(repoInput)
    if (parsed) {
      setAnalyzeAgainCalled(true)
      onAnalyzeNew(parsed.owner, parsed.repo)
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <input
          data-testid="repo-input"
          value={repoInput}
          onChange={e => setRepoInput(e.target.value)}
          aria-label="GitHub repository"
        />
        <button type="submit" data-testid="submit-btn">Analyze</button>
      </form>
      {inputError && <p data-testid="input-error">{inputError}</p>}

      {navigatedTo && <div data-testid="navigated-to">{navigatedTo}</div>}
      {analyzeAgainCalled && <div data-testid="analyze-again-called" />}

      {existingEntry && (
        <div
          className="switch-block-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="existing-repo-title"
          onClick={() => setExistingEntry(null)}
        >
          <div className="switch-block-modal" onClick={e => e.stopPropagation()}>
            <h2 id="existing-repo-title">Analysis already exists</h2>
            <p>{existingEntry.fullName}</p>
            <button
              data-testid="switch-to-repo"
              onClick={() => { setNavigatedTo(`/overview/${encodeURIComponent(existingEntry.taskId)}`); setExistingEntry(null) }}
            >
              Switch to repo
            </button>
            <button data-testid="analyze-again" onClick={handleAnalyzeAnyway}>
              Analyze again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

describe('DashboardPage — duplicate repo detection', () => {
  const analyzeNew = vi.fn()

  beforeEach(() => {
    lsMock.clear()
    analyzeNew.mockClear()
  })

  it('calls onAnalyzeNew when repo is not in history', () => {
    render(<DuplicateDetectionHarness onAnalyzeNew={analyzeNew} />)
    fireEvent.change(screen.getByTestId('repo-input'), { target: { value: 'facebook/react' } })
    fireEvent.click(screen.getByTestId('submit-btn'))
    expect(analyzeNew).toHaveBeenCalledWith('facebook', 'react')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the duplicate modal when repo already exists in history', () => {
    seedHistory([{ taskId: 'task-123', fullName: 'facebook/react', analyzedAt: new Date().toISOString() }])
    render(<DuplicateDetectionHarness onAnalyzeNew={analyzeNew} />)
    fireEvent.change(screen.getByTestId('repo-input'), { target: { value: 'facebook/react' } })
    fireEvent.click(screen.getByTestId('submit-btn'))
    expect(analyzeNew).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Analysis already exists')).toBeInTheDocument()
  })

  it('shows the matching repo fullName inside the modal', () => {
    seedHistory([{ taskId: 'task-123', fullName: 'facebook/react', analyzedAt: new Date().toISOString() }])
    render(<DuplicateDetectionHarness onAnalyzeNew={analyzeNew} />)
    fireEvent.change(screen.getByTestId('repo-input'), { target: { value: 'facebook/react' } })
    fireEvent.click(screen.getByTestId('submit-btn'))
    expect(screen.getByText('facebook/react')).toBeInTheDocument()
  })

  it('detection is case-insensitive (Facebook/React matches facebook/react)', () => {
    seedHistory([{ taskId: 'task-123', fullName: 'facebook/react', analyzedAt: new Date().toISOString() }])
    render(<DuplicateDetectionHarness onAnalyzeNew={analyzeNew} />)
    fireEvent.change(screen.getByTestId('repo-input'), { target: { value: 'Facebook/React' } })
    fireEvent.click(screen.getByTestId('submit-btn'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('detection works with a full GitHub URL input', () => {
    seedHistory([{ taskId: 'task-123', fullName: 'facebook/react', analyzedAt: new Date().toISOString() }])
    render(<DuplicateDetectionHarness onAnalyzeNew={analyzeNew} />)
    fireEvent.change(screen.getByTestId('repo-input'), { target: { value: 'https://github.com/facebook/react' } })
    fireEvent.click(screen.getByTestId('submit-btn'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('DashboardPage — duplicate modal interactions', () => {
  const analyzeNew = vi.fn()
  const entry = { taskId: 'task-456', fullName: 'psf/requests', analyzedAt: '2024-01-15T12:00:00Z' }

  beforeEach(() => {
    lsMock.clear()
    analyzeNew.mockClear()
    seedHistory([entry])
  })

  function openModal() {
    render(<DuplicateDetectionHarness onAnalyzeNew={analyzeNew} />)
    fireEvent.change(screen.getByTestId('repo-input'), { target: { value: 'psf/requests' } })
    fireEvent.click(screen.getByTestId('submit-btn'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  }

  it('"Switch to repo" navigates to the existing analysis URL', () => {
    openModal()
    fireEvent.click(screen.getByTestId('switch-to-repo'))
    expect(screen.getByTestId('navigated-to')).toHaveTextContent(`/overview/${encodeURIComponent(entry.taskId)}`)
  })

  it('"Switch to repo" closes the modal', () => {
    openModal()
    fireEvent.click(screen.getByTestId('switch-to-repo'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('"Analyze again" runs a fresh analysis', () => {
    openModal()
    fireEvent.click(screen.getByTestId('analyze-again'))
    expect(analyzeNew).toHaveBeenCalledWith('psf', 'requests')
    expect(screen.getByTestId('analyze-again-called')).toBeInTheDocument()
  })

  it('"Analyze again" closes the modal', () => {
    openModal()
    fireEvent.click(screen.getByTestId('analyze-again'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('clicking the overlay backdrop closes the modal', () => {
    openModal()
    fireEvent.click(screen.getByRole('dialog'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('clicking inside the modal card does not close the modal', () => {
    openModal()
    fireEvent.click(screen.getByText('Analysis already exists'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
