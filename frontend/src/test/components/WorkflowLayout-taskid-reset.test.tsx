/**
 * Tests for the taskId-change reset behavior in WorkflowLayout.
 *
 * WorkflowLayout is a persistent React Router outlet that does NOT unmount
 * when the user switches repos. The fix adds a useEffect that resets `result`,
 * `loading`, `error`, `maxStep`, and `analysisReady` whenever `taskId` changes,
 * so the UI immediately reflects the new repo rather than showing stale data.
 *
 * We test the extracted logic via a minimal harness that mirrors the same
 * state machine without mounting the full component and its dependencies.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { useEffect, useState } from 'react'

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
const lsMock = makeStorageMock()
vi.stubGlobal('sessionStorage', ssMock)
vi.stubGlobal('localStorage', lsMock)

interface FakeResult { owner: string; repo: string; metadata: { full_name: string } }

function loadProgress(taskId: string): number {
  const val = parseInt(localStorage.getItem(`contribiq:progress:${taskId}`) ?? '1', 10)
  return isNaN(val) ? 1 : Math.max(1, val)
}

function isAnalysisReady(taskId: string) {
  return !!sessionStorage.getItem(`arch-${taskId}`)
}

/**
 * Harness that mirrors the WorkflowLayout reset-on-taskId-change useEffect.
 * Renders the current repo name and loading state so tests can assert on them.
 */
function LayoutHarness({
  taskId,
  fetchResult,
}: {
  taskId: string
  fetchResult: (id: string) => Promise<FakeResult>
}) {
  const cacheKey = `analysis:${taskId}`

  const [result, setResult] = useState<FakeResult | null>(() => {
    try { const c = ssMock.getItem(cacheKey); return c ? JSON.parse(c) : null } catch { return null }
  })
  const [loading, setLoading] = useState(!ssMock.getItem(cacheKey))
  const [error, setError] = useState('')
  const [maxStep, setMaxStep] = useState(() => loadProgress(taskId))
  const [analysisReady, setAnalysisReady] = useState(() => isAnalysisReady(taskId))

  // Reset state immediately when taskId changes (repo switch)
  useEffect(() => {
    try {
      const cached = ssMock.getItem(`analysis:${taskId}`)
      setResult(cached ? JSON.parse(cached) : null)
      setLoading(!cached)
      setError('')
      setMaxStep(loadProgress(taskId))
      setAnalysisReady(isAnalysisReady(taskId))
    } catch {
      setResult(null)
      setLoading(true)
    }
  }, [taskId])

  // Fetch from API
  useEffect(() => {
    let active = true
    setLoading(true)
    fetchResult(taskId)
      .then(data => {
        if (!active) return
        setResult(data)
        ssMock.setItem(`analysis:${taskId}`, JSON.stringify(data))
      })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Error') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [taskId, fetchResult])

  if (loading) return <div data-testid="loading">Loading...</div>
  if (error) return <div data-testid="error">{error}</div>
  return (
    <div>
      <div data-testid="repo-name">{result?.metadata.full_name ?? 'unknown'}</div>
      <div data-testid="max-step">{maxStep}</div>
      <div data-testid="analysis-ready">{String(analysisReady)}</div>
    </div>
  )
}

function makeResult(owner: string, repo: string): FakeResult {
  return { owner, repo, metadata: { full_name: `${owner}/${repo}` } }
}

describe('WorkflowLayout — taskId change resets stale result', () => {
  beforeEach(() => {
    ssMock.clear()
    lsMock.clear()
  })

  it('shows loading state while fetching on first mount (no cache)', async () => {
    const fetchResult = vi.fn().mockReturnValue(new Promise(() => {})) // never resolves
    const { unmount } = render(<LayoutHarness taskId="task-1" fetchResult={fetchResult} />)
    expect(screen.getByTestId('loading')).toBeInTheDocument()
    unmount()
  })

  it('displays repo name after fetch completes', async () => {
    const fetchResult = vi.fn().mockResolvedValue(makeResult('org', 'repo-a'))
    render(<LayoutHarness taskId="task-1" fetchResult={fetchResult} />)
    await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument())
    expect(screen.getByTestId('repo-name')).toHaveTextContent('org/repo-a')
  })

  it('when switching taskId, clears result immediately (shows loading) if new repo has no cache', async () => {
    // Pre-seed cache for task-1 so it starts loaded
    ssMock.setItem('analysis:task-1', JSON.stringify(makeResult('org', 'repo-a')))

    const fetchResult = vi.fn()
      .mockResolvedValueOnce(makeResult('org', 'repo-a'))
      .mockReturnValue(new Promise(() => {})) // task-2 never resolves

    const { rerender } = render(<LayoutHarness taskId="task-1" fetchResult={fetchResult} />)
    await waitFor(() => expect(screen.getByTestId('repo-name')).toHaveTextContent('org/repo-a'))

    // Switch to task-2 which has no cache
    act(() => { rerender(<LayoutHarness taskId="task-2" fetchResult={fetchResult} />) })
    expect(screen.getByTestId('loading')).toBeInTheDocument()
    expect(screen.queryByTestId('repo-name')).not.toBeInTheDocument()
  })

  it('when switching taskId, shows cached data immediately if new repo has a cache entry', async () => {
    ssMock.setItem('analysis:task-1', JSON.stringify(makeResult('org', 'repo-a')))
    ssMock.setItem('analysis:task-2', JSON.stringify(makeResult('org', 'repo-b')))

    // Both fetches resolve with their respective repos
    const fetchResult = vi.fn()
      .mockResolvedValueOnce(makeResult('org', 'repo-a'))
      .mockResolvedValueOnce(makeResult('org', 'repo-b'))

    const { rerender } = render(<LayoutHarness taskId="task-1" fetchResult={fetchResult} />)
    await waitFor(() => expect(screen.getByTestId('repo-name')).toBeInTheDocument())

    act(() => { rerender(<LayoutHarness taskId="task-2" fetchResult={fetchResult} />) })

    // After switching, final state must show repo-b (from cache or fetch)
    await waitFor(() => expect(screen.getByTestId('repo-name')).toHaveTextContent('org/repo-b'))
    expect(screen.queryByTestId('loading')).not.toBeInTheDocument()
  })

  it('does not show stale repo name from old taskId after switching', async () => {
    ssMock.setItem('analysis:task-1', JSON.stringify(makeResult('org', 'repo-a')))

    const fetchResult = vi.fn()
      .mockResolvedValueOnce(makeResult('org', 'repo-a'))
      .mockResolvedValueOnce(makeResult('org', 'repo-b'))

    const { rerender } = render(<LayoutHarness taskId="task-1" fetchResult={fetchResult} />)
    await waitFor(() => expect(screen.getByTestId('repo-name')).toHaveTextContent('org/repo-a'))

    act(() => { rerender(<LayoutHarness taskId="task-2" fetchResult={fetchResult} />) })
    await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument())

    expect(screen.getByTestId('repo-name')).toHaveTextContent('org/repo-b')
    expect(screen.getByTestId('repo-name')).not.toHaveTextContent('org/repo-a')
  })

  it('resets maxStep to the saved progress for the new taskId', async () => {
    ssMock.setItem('analysis:task-1', JSON.stringify(makeResult('org', 'repo-a')))
    ssMock.setItem('analysis:task-2', JSON.stringify(makeResult('org', 'repo-b')))
    lsMock.setItem('contribiq:progress:task-1', '4')
    lsMock.setItem('contribiq:progress:task-2', '2')

    const fetchResult = vi.fn().mockResolvedValue(makeResult('org', 'repo-b'))
    const { rerender } = render(<LayoutHarness taskId="task-1" fetchResult={fetchResult} />)
    await waitFor(() => expect(screen.getByTestId('max-step')).toHaveTextContent('4'))

    act(() => { rerender(<LayoutHarness taskId="task-2" fetchResult={fetchResult} />) })
    await waitFor(() => expect(screen.getByTestId('max-step')).toHaveTextContent('2'))
  })

  it('resets analysisReady based on the new taskId arch-* key', async () => {
    ssMock.setItem('analysis:task-1', JSON.stringify(makeResult('org', 'repo-a')))
    ssMock.setItem('analysis:task-2', JSON.stringify(makeResult('org', 'repo-b')))
    ssMock.setItem('arch-task-1', 'diagram-data')
    // task-2 has no arch-* key → not ready

    const fetchResult = vi.fn().mockResolvedValue(makeResult('org', 'repo-b'))
    const { rerender } = render(<LayoutHarness taskId="task-1" fetchResult={fetchResult} />)
    await waitFor(() => expect(screen.getByTestId('analysis-ready')).toHaveTextContent('true'))

    act(() => { rerender(<LayoutHarness taskId="task-2" fetchResult={fetchResult} />) })
    await waitFor(() => expect(screen.getByTestId('analysis-ready')).toHaveTextContent('false'))
  })

  it('clears error state when switching taskId', async () => {
    // task-1 fetch fails, task-2 fetch succeeds
    const fetchResult = vi.fn()
      .mockRejectedValueOnce(new Error('API error'))
      .mockResolvedValue(makeResult('org', 'repo-b'))

    // Start with task-1 (no cache) — will show error
    const { rerender } = render(<LayoutHarness taskId="task-1" fetchResult={fetchResult} />)
    await waitFor(() => expect(screen.getByTestId('error')).toHaveTextContent('API error'))

    // Switch to task-2 — reset effect clears error, then fetch resolves
    act(() => { rerender(<LayoutHarness taskId="task-2" fetchResult={fetchResult} />) })
    await waitFor(() => expect(screen.queryByTestId('error')).not.toBeInTheDocument())
    expect(screen.getByTestId('repo-name')).toHaveTextContent('org/repo-b')
  })
})
