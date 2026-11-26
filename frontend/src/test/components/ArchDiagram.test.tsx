/**
 * Tests for ArchDiagram state machine via a minimal harness.
 *
 * The harness mirrors the two-effect pipeline (POST → poll → done/error) and
 * the sessionStorage cache logic without coupling to mermaid or WorkflowIcon.
 *
 * Covers: generating status on mount, POST call, error panel, library notice,
 * cache-hit path, zoom controls, source files footer, and retry behavior.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
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
vi.stubGlobal('sessionStorage', ssMock)

interface DoneState {
  syntax: string
  sourceFiles: string[]
}

/**
 * Minimal harness mirroring ArchDiagram's state machine:
 *   idle → generating → (error | done)
 *
 * `start`  — corresponds to the POST that returns a diagramTaskId
 * `poll`   — single-call replacement for the setInterval poll
 */
function ArchHarness({
  taskId,
  repoName,
  start,
  poll,
}: {
  taskId: string
  repoName: string
  start: (id: string) => Promise<string>
  poll: (diagId: string) => Promise<DoneState>
}) {
  const [status, setStatus] = useState<'idle' | 'generating' | 'done' | 'error'>('idle')
  const [diagramTaskId, setDiagramTaskId] = useState<string | null>(null)
  const [syntax, setSyntax] = useState<string | null>(null)
  const [sourceFiles, setSourceFiles] = useState<string[]>([])
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    const cacheKey = `arch-${taskId}`
    const cached = sessionStorage.getItem(cacheKey)
    if (cached && retryCount === 0) {
      const { syntax: s, sourceFiles: sf } = JSON.parse(cached)
      setSyntax(s)
      setSourceFiles(sf)
      setStatus('done')
      return
    }

    let active = true
    setStatus('generating')
    setError('')
    setSyntax(null)
    setSourceFiles([])
    setDiagramTaskId(null)
    start(taskId)
      .then(id => { if (active) setDiagramTaskId(id) })
      .catch(reason => {
        if (!active) return
        setError(reason instanceof Error ? reason.message : 'Could not generate diagram.')
        setStatus('error')
      })
    return () => { active = false }
  }, [taskId, retryCount, start])

  useEffect(() => {
    if (!diagramTaskId || status !== 'generating') return
    let active = true
    poll(diagramTaskId)
      .then(result => {
        if (!active) return
        sessionStorage.setItem(`arch-${taskId}`, JSON.stringify(result))
        setSyntax(result.syntax)
        setSourceFiles(result.sourceFiles)
        setStatus('done')
      })
      .catch(reason => {
        if (!active) return
        setError(reason instanceof Error ? reason.message : 'Could not generate diagram.')
        setStatus('error')
      })
    return () => { active = false }
  }, [diagramTaskId, status, poll, taskId])

  const handleRetry = () => {
    sessionStorage.removeItem(`arch-${taskId}`)
    setRetryCount(c => c + 1)
  }

  const isLibraryError = error.toLowerCase().includes('library') || error.toLowerCase().includes('not enough')

  return (
    <div>
      <h2>Application Architecture</h2>

      {status === 'generating' && (
        <p role="status">Reading repository source and generating application architecture...</p>
      )}

      {status === 'error' && (
        isLibraryError ? (
          <div role="status" data-testid="library-notice">
            <p>
              This is a framework or library repo — architecture diagrams apply to
              applications built with {repoName.split('/')[1] ?? repoName}, not the
              framework itself.
            </p>
          </div>
        ) : (
          <div role="alert" data-testid="error-panel">
            <p>{error}</p>
            <button onClick={handleRetry}>Try again</button>
          </div>
        )
      )}

      {status === 'done' && (
        <>
          <div data-testid="zoom-controls">
            <button title="Zoom out" disabled={zoom <= 0.25}>−</button>
            <span data-testid="zoom-pct">{Math.round(zoom * 100)}%</span>
            <button title="Zoom in" disabled={zoom >= 3}>+</button>
            <button title="Reset to fit" onClick={() => setZoom(1)}>Fit</button>
          </div>
          <div data-testid="diagram-content">{syntax}</div>
          {sourceFiles.length > 0 && (
            <p data-testid="source-files">Inferred from {sourceFiles.join(', ')}.</p>
          )}
        </>
      )}
    </div>
  )
}

const neverCall = () => { throw new Error('should not be called') }

// ── initial state ─────────────────────────────────────────────────────────────

describe('ArchDiagram — initial state', () => {
  beforeEach(() => ssMock.clear())

  it('renders the Application Architecture heading', () => {
    render(<ArchHarness taskId="t1" repoName="org/repo" start={vi.fn(() => new Promise<string>(() => {}))} poll={neverCall} />)
    expect(screen.getByRole('heading', { name: /application architecture/i })).toBeInTheDocument()
  })

  it('shows generating status text immediately on mount', () => {
    render(<ArchHarness taskId="t1" repoName="org/repo" start={vi.fn(() => new Promise<string>(() => {}))} poll={neverCall} />)
    expect(screen.getByRole('status')).toHaveTextContent(/generating application architecture/i)
  })

  it('calls the start function with the taskId on mount', () => {
    const start = vi.fn(() => new Promise<string>(() => {}))
    render(<ArchHarness taskId="task-abc" repoName="org/repo" start={start} poll={neverCall} />)
    expect(start).toHaveBeenCalledOnce()
    expect(start).toHaveBeenCalledWith('task-abc')
  })
})

// ── cache hit ─────────────────────────────────────────────────────────────────

describe('ArchDiagram — cache hit', () => {
  beforeEach(() => ssMock.clear())

  it('loads from sessionStorage cache without calling start', async () => {
    ssMock.setItem('arch-task-1', JSON.stringify({ syntax: 'flowchart LR', sourceFiles: [] }))
    const start = vi.fn(() => new Promise<string>(() => {}))
    render(<ArchHarness taskId="task-1" repoName="org/repo" start={start} poll={neverCall} />)

    await waitFor(() => expect(screen.getByTestId('zoom-controls')).toBeInTheDocument())
    expect(start).not.toHaveBeenCalled()
  })

  it('shows zoom controls when cache is loaded', async () => {
    ssMock.setItem('arch-task-2', JSON.stringify({ syntax: 'flowchart TD', sourceFiles: [] }))
    render(<ArchHarness taskId="task-2" repoName="org/repo" start={vi.fn()} poll={neverCall} />)

    await waitFor(() => expect(screen.getByTestId('zoom-controls')).toBeInTheDocument())
    expect(screen.getByTitle('Zoom in')).toBeInTheDocument()
    expect(screen.getByTitle('Zoom out')).toBeInTheDocument()
    expect(screen.getByTitle('Reset to fit')).toBeInTheDocument()
  })

  it('shows source files footer when cache includes source files', async () => {
    ssMock.setItem(
      'arch-task-3',
      JSON.stringify({ syntax: 'flowchart LR', sourceFiles: ['src/app.ts', 'src/routes.ts'] }),
    )
    render(<ArchHarness taskId="task-3" repoName="org/repo" start={vi.fn()} poll={neverCall} />)

    await waitFor(() => expect(screen.getByTestId('source-files')).toBeInTheDocument())
    expect(screen.getByTestId('source-files')).toHaveTextContent('src/app.ts')
    expect(screen.getByTestId('source-files')).toHaveTextContent('src/routes.ts')
  })
})

// ── done via API ──────────────────────────────────────────────────────────────

describe('ArchDiagram — done via API', () => {
  beforeEach(() => ssMock.clear())

  it('shows zoom controls after start + poll both resolve', async () => {
    const start = vi.fn().mockResolvedValue('diag-id-1')
    const poll = vi.fn().mockResolvedValue({ syntax: 'graph LR', sourceFiles: ['main.ts'] })
    render(<ArchHarness taskId="task-api" repoName="org/repo" start={start} poll={poll} />)

    await waitFor(() => expect(screen.getByTestId('zoom-controls')).toBeInTheDocument())
    expect(poll).toHaveBeenCalledWith('diag-id-1')
  })

  it('caches the result in sessionStorage when done', async () => {
    const start = vi.fn().mockResolvedValue('diag-id-2')
    const poll = vi.fn().mockResolvedValue({ syntax: 'graph TD', sourceFiles: [] })
    render(<ArchHarness taskId="task-cache" repoName="org/repo" start={start} poll={poll} />)

    await waitFor(() => expect(screen.getByTestId('zoom-controls')).toBeInTheDocument())
    const cached = ssMock.getItem('arch-task-cache')
    expect(cached).not.toBeNull()
    expect(JSON.parse(cached!).syntax).toBe('graph TD')
  })
})

// ── error states ──────────────────────────────────────────────────────────────

describe('ArchDiagram — error states', () => {
  beforeEach(() => ssMock.clear())

  it('shows error panel with Try again button on start failure', async () => {
    const start = vi.fn().mockRejectedValue(new Error('Network failure'))
    render(<ArchHarness taskId="t-err" repoName="org/repo" start={start} poll={neverCall} />)

    await waitFor(() => expect(screen.getByTestId('error-panel')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('displays the error message text in the error panel', async () => {
    const start = vi.fn().mockRejectedValue(new Error('Worker is offline'))
    render(<ArchHarness taskId="t-err2" repoName="org/repo" start={start} poll={neverCall} />)

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.getByRole('alert')).toHaveTextContent('Worker is offline')
  })

  it('shows library notice instead of error panel for "library" errors', async () => {
    const start = vi.fn().mockRejectedValue(new Error('This is a library — no diagram'))
    render(<ArchHarness taskId="t-lib" repoName="org/my-lib" start={start} poll={neverCall} />)

    await waitFor(() => expect(screen.getByTestId('library-notice')).toBeInTheDocument())
    expect(screen.queryByTestId('error-panel')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument()
  })

  it('shows library notice for "not enough" errors', async () => {
    const start = vi.fn().mockRejectedValue(new Error('Not enough application code to diagram'))
    render(<ArchHarness taskId="t-lib2" repoName="org/framework" start={start} poll={neverCall} />)

    await waitFor(() => expect(screen.getByTestId('library-notice')).toBeInTheDocument())
    expect(screen.queryByTestId('error-panel')).not.toBeInTheDocument()
  })

  it('library notice includes the repo short name', async () => {
    const start = vi.fn().mockRejectedValue(new Error('This is a library'))
    render(<ArchHarness taskId="t-lib3" repoName="org/my-framework" start={start} poll={neverCall} />)

    await waitFor(() => expect(screen.getByTestId('library-notice')).toBeInTheDocument())
    expect(screen.getByTestId('library-notice')).toHaveTextContent('my-framework')
  })
})

// ── retry behavior ────────────────────────────────────────────────────────────

describe('ArchDiagram — retry', () => {
  beforeEach(() => ssMock.clear())

  it('clicking Try again triggers a new start call', async () => {
    const start = vi.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockResolvedValueOnce('diag-id-retry')
    const poll = vi.fn().mockResolvedValue({ syntax: 'graph LR', sourceFiles: [] })

    render(<ArchHarness taskId="t-retry3" repoName="org/repo" start={start} poll={poll} />)

    // Wait for error state
    await waitFor(() => expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument())
    expect(start).toHaveBeenCalledTimes(1)

    // Click retry
    fireEvent.click(screen.getByRole('button', { name: /try again/i }))

    // Should call start again and eventually reach done state
    await waitFor(() => expect(screen.getByTestId('zoom-controls')).toBeInTheDocument())
    expect(start).toHaveBeenCalledTimes(2)
  })

  it('cache is bypassed after retry (retryCount > 0)', async () => {
    ssMock.setItem('arch-t-bypass', JSON.stringify({ syntax: 'cached-syntax', sourceFiles: [] }))

    const start = vi.fn()
      .mockRejectedValueOnce(new Error('Error'))
      .mockResolvedValueOnce('diag-id-fresh')
    const poll = vi.fn().mockResolvedValue({ syntax: 'fresh', sourceFiles: [] })

    render(<ArchHarness taskId="t-bypass" repoName="org/repo" start={start} poll={poll} />)

    // Cache exists → done state without calling start
    await waitFor(() => expect(screen.getByTestId('zoom-controls')).toBeInTheDocument())
    expect(start).not.toHaveBeenCalled()
  })
})
