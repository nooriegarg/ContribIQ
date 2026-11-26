/**
 * Integration tests for useWorkflow — verifies it correctly plumbs through
 * React Router's outlet context (taskId, basePath, result).
 *
 * Since useWorkflow is a thin wrapper around useOutletContext<WorkflowContext>,
 * these tests render a minimal Router+Outlet harness to confirm the values
 * set on the parent Route's <Outlet context={...}> are returned by the hook.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Outlet, Route, Routes } from 'react-router-dom'
import { useWorkflow } from '../../hooks/useWorkflow'
import type { WorkflowContext } from '../../components/WorkflowLayout'
import type { AnalysisResult } from '../../api/analyze'

// Consumer renders each context field into the DOM so tests can assert on them
function WorkflowConsumer() {
  const { taskId, basePath, result } = useWorkflow()
  return (
    <div>
      <span data-testid="taskId">{taskId}</span>
      <span data-testid="basePath">{basePath}</span>
      <span data-testid="result">{result ? 'has-result' : 'null'}</span>
    </div>
  )
}

function RouterHarness({ ctx }: { ctx: WorkflowContext }) {
  return (
    <MemoryRouter initialEntries={['/']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<Outlet context={ctx} />}>
          <Route index element={<WorkflowConsumer />} />
        </Route>
      </Routes>
    </MemoryRouter>
  )
}

const BASE_CTX: WorkflowContext = {
  taskId: 'task-123',
  basePath: '/analysis/task-123',
  result: null,
}

// ── taskId ────────────────────────────────────────────────────────────────────

describe('useWorkflow — taskId', () => {
  it('returns the taskId set on the outlet context', () => {
    render(<RouterHarness ctx={{ ...BASE_CTX, taskId: 'abc-456' }} />)
    expect(screen.getByTestId('taskId')).toHaveTextContent('abc-456')
  })

  it('reflects a different taskId without re-mounting the consumer', () => {
    const { rerender } = render(<RouterHarness ctx={{ ...BASE_CTX, taskId: 'first' }} />)
    expect(screen.getByTestId('taskId')).toHaveTextContent('first')
    rerender(<RouterHarness ctx={{ ...BASE_CTX, taskId: 'second' }} />)
    expect(screen.getByTestId('taskId')).toHaveTextContent('second')
  })
})

// ── basePath ──────────────────────────────────────────────────────────────────

describe('useWorkflow — basePath', () => {
  it('returns the basePath set on the outlet context', () => {
    render(<RouterHarness ctx={{ ...BASE_CTX, basePath: '/analysis/xyz' }} />)
    expect(screen.getByTestId('basePath')).toHaveTextContent('/analysis/xyz')
  })
})

// ── result ────────────────────────────────────────────────────────────────────

describe('useWorkflow — result', () => {
  it('returns null for result when context carries null', () => {
    render(<RouterHarness ctx={{ ...BASE_CTX, result: null }} />)
    expect(screen.getByTestId('result')).toHaveTextContent('null')
  })

  it('returns the result object when context carries analysis data', () => {
    const result = { owner: 'org', repo: 'repo' } as unknown as AnalysisResult
    render(<RouterHarness ctx={{ ...BASE_CTX, result }} />)
    expect(screen.getByTestId('result')).toHaveTextContent('has-result')
  })
})

// ── all fields together ───────────────────────────────────────────────────────

describe('useWorkflow — all fields', () => {
  it('returns all three context fields simultaneously', () => {
    const result = { owner: 'myorg', repo: 'myrepo' } as unknown as AnalysisResult
    render(
      <RouterHarness
        ctx={{ taskId: 'task-full', basePath: '/analysis/task-full', result }}
      />,
    )
    expect(screen.getByTestId('taskId')).toHaveTextContent('task-full')
    expect(screen.getByTestId('basePath')).toHaveTextContent('/analysis/task-full')
    expect(screen.getByTestId('result')).toHaveTextContent('has-result')
  })
})
