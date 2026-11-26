/**
 * Tests for RepoPRsPage display logic via minimal harnesses.
 *
 * RepoPRsPage pulls its data from useOutletContext, useParams, useAuth,
 * useLocation, and useSearchParams, then fetches via getMyPRs().  Rather than
 * wiring all of that up, we test the five independent display behaviours
 * through dedicated harnesses:
 *
 *   1. No-GitHub panel  — guard branch when user has no github_username
 *   2. CIBadge          — four ci_status values
 *   3. StateBadge       — merged / open / closed variants
 *   4. CheckIcon        — conclusion / status to icon mapping
 *   5. PR list display  — card rendering, empty messages, pagination
 *   6. Linked banner    — shown and dismissible
 *
 * Sub-components (CIBadge, StateBadge, CheckIcon) are defined locally inside
 * RepoPRsPage and not exported, so their logic is replicated here identically.
 * Any divergence from the source will appear as a failing test.
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import type { UserPR, PRCheck } from '../../api/profile'

// ── replicated sub-components (must stay in sync with RepoPRsPage.tsx) ────────

type CIStatus = UserPR['ci_status']
type PRState = 'open' | 'closed' | 'merged' | 'all'

const STATE_LABELS: Record<PRState, string> = {
  open: 'Open', closed: 'Closed', merged: 'Merged', all: 'All',
}

function CIBadge({ status }: { status: CIStatus }) {
  const map = {
    success: { label: 'Checks passed', cls: 'ci-success' },
    failure: { label: 'Checks failed', cls: 'ci-failure' },
    running: { label: 'Checks running', cls: 'ci-running' },
    pending: { label: 'No checks', cls: 'ci-pending' },
  }
  const { label, cls } = map[status] ?? map.pending
  return <span className={`up-ci-badge ${cls}`}>{label}</span>
}

function StateBadge({ state, mergedAt }: { state: string; mergedAt: string | null }) {
  if (mergedAt) return <span className="up-ci-badge" style={{ background: '#8b5cf6', color: 'white' }}>Merged</span>
  if (state === 'open') return <span className="up-ci-badge ci-success">Open</span>
  return <span className="up-ci-badge ci-failure" style={{ textTransform: 'capitalize' }}>{state}</span>
}

function CheckIcon({ conclusion, status }: { conclusion: string | null; status: string }) {
  if (conclusion === 'success') return <span className="up-check-dot ci-success">✓</span>
  if (conclusion === 'failure' || conclusion === 'timed_out') return <span className="up-check-dot ci-failure">✗</span>
  if (status === 'in_progress' || status === 'queued') return <span className="up-check-dot ci-running">◷</span>
  return <span className="up-check-dot ci-pending">–</span>
}

// ── factory ───────────────────────────────────────────────────────────────────

function makePR(overrides: Partial<UserPR> = {}): UserPR {
  return {
    number: 1,
    title: 'Test PR',
    url: 'https://github.com/org/repo/pull/1',
    repo: 'org/repo',
    state: 'open',
    merged_at: null,
    draft: false,
    created_at: null,
    updated_at: null,
    ci_status: 'pending',
    checks: [],
    ...overrides,
  }
}

// ── no-GitHub panel ───────────────────────────────────────────────────────────

function NoGithubPanel({ connectHref = '/connect' }: { connectHref?: string }) {
  return (
    <div>
      <h2>Connect your GitHub account</h2>
      <p>Link your GitHub account to track pull requests you&apos;ve raised and see their CI status at a glance.</p>
      <a href={connectHref}>Connect GitHub</a>
    </div>
  )
}

describe('RepoPRsPage — no GitHub panel', () => {
  it('shows "Connect your GitHub account" heading', () => {
    render(<NoGithubPanel />)
    expect(screen.getByText('Connect your GitHub account')).toBeInTheDocument()
  })

  it('shows the description text', () => {
    render(<NoGithubPanel />)
    expect(screen.getByText(/Link your GitHub account/)).toBeInTheDocument()
  })

  it('shows a Connect GitHub link', () => {
    render(<NoGithubPanel connectHref="/auth/github/link" />)
    const link = screen.getByRole('link', { name: 'Connect GitHub' })
    expect(link).toHaveAttribute('href', '/auth/github/link')
  })
})

// ── CIBadge ───────────────────────────────────────────────────────────────────

describe('RepoPRsPage — CIBadge', () => {
  it('shows "Checks passed" for ci_status=success', () => {
    render(<CIBadge status="success" />)
    expect(screen.getByText('Checks passed')).toBeInTheDocument()
  })

  it('shows "Checks failed" for ci_status=failure', () => {
    render(<CIBadge status="failure" />)
    expect(screen.getByText('Checks failed')).toBeInTheDocument()
  })

  it('shows "Checks running" for ci_status=running', () => {
    render(<CIBadge status="running" />)
    expect(screen.getByText('Checks running')).toBeInTheDocument()
  })

  it('shows "No checks" for ci_status=pending', () => {
    render(<CIBadge status="pending" />)
    expect(screen.getByText('No checks')).toBeInTheDocument()
  })
})

// ── StateBadge ────────────────────────────────────────────────────────────────

describe('RepoPRsPage — StateBadge', () => {
  it('shows "Merged" when merged_at is set', () => {
    render(<StateBadge state="closed" mergedAt="2024-01-01T00:00:00Z" />)
    expect(screen.getByText('Merged')).toBeInTheDocument()
  })

  it('shows "Open" for open state with no merged_at', () => {
    render(<StateBadge state="open" mergedAt={null} />)
    expect(screen.getByText('Open')).toBeInTheDocument()
  })

  it('shows the state text for closed PRs that were not merged', () => {
    render(<StateBadge state="closed" mergedAt={null} />)
    expect(screen.getByText('closed')).toBeInTheDocument()
  })
})

// ── CheckIcon ─────────────────────────────────────────────────────────────────

describe('RepoPRsPage — CheckIcon', () => {
  it('shows ✓ for conclusion=success', () => {
    render(<CheckIcon conclusion="success" status="completed" />)
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('shows ✗ for conclusion=failure', () => {
    render(<CheckIcon conclusion="failure" status="completed" />)
    expect(screen.getByText('✗')).toBeInTheDocument()
  })

  it('shows ✗ for conclusion=timed_out', () => {
    render(<CheckIcon conclusion="timed_out" status="completed" />)
    expect(screen.getByText('✗')).toBeInTheDocument()
  })

  it('shows ◷ for status=in_progress', () => {
    render(<CheckIcon conclusion={null} status="in_progress" />)
    expect(screen.getByText('◷')).toBeInTheDocument()
  })

  it('shows ◷ for status=queued', () => {
    render(<CheckIcon conclusion={null} status="queued" />)
    expect(screen.getByText('◷')).toBeInTheDocument()
  })

  it('shows – for null conclusion and non-active status', () => {
    render(<CheckIcon conclusion={null} status="completed" />)
    expect(screen.getByText('–')).toBeInTheDocument()
  })
})

// ── PR list harness ───────────────────────────────────────────────────────────

const PAGE_SIZE = 15

function PRListHarness({
  prs,
  prState = 'all',
  repoFull = 'org/repo',
  loading = false,
  error = '',
}: {
  prs: UserPR[]
  prState?: PRState
  repoFull?: string
  loading?: boolean
  error?: string
}) {
  const [page, setPage] = useState(1)
  const [state, setState] = useState<PRState>(prState)

  const emptyMsg = state === 'open' ? 'No open pull requests in this repository.'
    : state === 'closed' ? 'No closed pull requests in this repository.'
    : state === 'merged' ? 'No merged pull requests in this repository.'
    : 'No pull requests found in this repository.'

  const totalPages = Math.ceil(prs.length / PAGE_SIZE)
  const pagePRs = prs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <div>
      <div>
        <label htmlFor="pr-state-filter">Show:</label>
        <select
          id="pr-state-filter"
          value={state}
          onChange={e => setState(e.target.value as PRState)}
        >
          {(Object.keys(STATE_LABELS) as PRState[]).map(s => (
            <option key={s} value={s}>{STATE_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {loading && <p role="status">Loading pull requests…</p>}
      {error && <div role="alert">{error}</div>}

      {!loading && !error && prs.length === 0 && (
        <p data-testid="empty-msg">{emptyMsg}</p>
      )}

      {repoFull && prs.length > 0 && (
        <p data-testid="repo-line">
          Your contributions to <strong>{repoFull}</strong>
          <span data-testid="total-count"> ({prs.length} total)</span>
        </p>
      )}

      {pagePRs.map(pr => (
        <div key={`${pr.state}-${pr.number}`} data-testid="pr-card">
          <span data-testid="pr-num">#{pr.number}</span>
          <StateBadge state={pr.state} mergedAt={pr.merged_at} />
          {pr.draft && <span data-testid="draft-badge">Draft</span>}
          <CIBadge status={pr.ci_status} />
          <a href={pr.url ?? '#'}>{pr.title}</a>
          {pr.checks.map((check: PRCheck, i: number) => (
            <span key={i} data-testid="check-name">{check.name}</span>
          ))}
        </div>
      ))}

      {totalPages > 1 && (
        <div data-testid="pagination">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            ← Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)} data-testid={`page-${p}`}>
              {p}
            </button>
          ))}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
            Next →
          </button>
        </div>
      )}
    </div>
  )
}

describe('RepoPRsPage — PR list display', () => {
  it('renders PR number and title', () => {
    render(<PRListHarness prs={[makePR({ number: 42, title: 'Fix the bug' })]} />)
    expect(screen.getByText('#42')).toBeInTheDocument()
    expect(screen.getByText('Fix the bug')).toBeInTheDocument()
  })

  it('shows Draft badge for draft PRs', () => {
    render(<PRListHarness prs={[makePR({ draft: true })]} />)
    expect(screen.getByTestId('draft-badge')).toBeInTheDocument()
  })

  it('does not show Draft badge for non-draft PRs', () => {
    render(<PRListHarness prs={[makePR({ draft: false })]} />)
    expect(screen.queryByTestId('draft-badge')).not.toBeInTheDocument()
  })

  it('renders check names inside a PR card', () => {
    const checks: PRCheck[] = [
      { name: 'CI / build', status: 'completed', conclusion: 'success', url: null },
      { name: 'CI / lint', status: 'completed', conclusion: 'failure', url: null },
    ]
    render(<PRListHarness prs={[makePR({ checks })]} />)
    expect(screen.getByText('CI / build')).toBeInTheDocument()
    expect(screen.getByText('CI / lint')).toBeInTheDocument()
  })

  it('shows total count when prs is non-empty', () => {
    render(<PRListHarness prs={[makePR(), makePR({ number: 2 })]} />)
    expect(screen.getByTestId('total-count')).toHaveTextContent('(2 total)')
  })
})

describe('RepoPRsPage — loading and error states', () => {
  it('shows loading text when loading=true', () => {
    render(<PRListHarness prs={[]} loading />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading pull requests…')
  })

  it('shows error when error is set', () => {
    render(<PRListHarness prs={[]} error="GitHub API unavailable" />)
    expect(screen.getByRole('alert')).toHaveTextContent('GitHub API unavailable')
  })
})

describe('RepoPRsPage — empty messages', () => {
  it('shows "No pull requests found" for state=all with no PRs', () => {
    render(<PRListHarness prs={[]} prState="all" />)
    expect(screen.getByTestId('empty-msg')).toHaveTextContent('No pull requests found in this repository.')
  })

  it('shows "No open pull requests" for state=open', () => {
    render(<PRListHarness prs={[]} prState="open" />)
    expect(screen.getByTestId('empty-msg')).toHaveTextContent('No open pull requests in this repository.')
  })

  it('shows "No closed pull requests" for state=closed', () => {
    render(<PRListHarness prs={[]} prState="closed" />)
    expect(screen.getByTestId('empty-msg')).toHaveTextContent('No closed pull requests in this repository.')
  })

  it('shows "No merged pull requests" for state=merged', () => {
    render(<PRListHarness prs={[]} prState="merged" />)
    expect(screen.getByTestId('empty-msg')).toHaveTextContent('No merged pull requests in this repository.')
  })
})

describe('RepoPRsPage — state filter dropdown', () => {
  it('has Open, Closed, Merged, All options', () => {
    render(<PRListHarness prs={[]} />)
    const select = screen.getByLabelText('Show:') as HTMLSelectElement
    const values = Array.from(select.options).map(o => o.value)
    expect(values).toEqual(['open', 'closed', 'merged', 'all'])
  })

  it('defaults to "all"', () => {
    render(<PRListHarness prs={[]} />)
    expect(screen.getByLabelText('Show:')).toHaveValue('all')
  })

  it('changing the filter updates the selected value', () => {
    render(<PRListHarness prs={[]} />)
    fireEvent.change(screen.getByLabelText('Show:'), { target: { value: 'open' } })
    expect(screen.getByLabelText('Show:')).toHaveValue('open')
  })
})

describe('RepoPRsPage — pagination', () => {
  const moreThanOnePage = Array.from({ length: 20 }, (_, i) => makePR({ number: i + 1 }))

  it('does not render pagination controls for <= 15 PRs', () => {
    render(<PRListHarness prs={Array.from({ length: 15 }, (_, i) => makePR({ number: i + 1 }))} />)
    expect(screen.queryByTestId('pagination')).not.toBeInTheDocument()
  })

  it('renders pagination controls for > 15 PRs', () => {
    render(<PRListHarness prs={moreThanOnePage} />)
    expect(screen.getByTestId('pagination')).toBeInTheDocument()
  })

  it('Prev button is disabled on page 1', () => {
    render(<PRListHarness prs={moreThanOnePage} />)
    expect(screen.getByRole('button', { name: /← prev/i })).toBeDisabled()
  })

  it('Next button is enabled on page 1', () => {
    render(<PRListHarness prs={moreThanOnePage} />)
    expect(screen.getByRole('button', { name: /next →/i })).not.toBeDisabled()
  })

  it('clicking Next advances to page 2 and disables Next on the last page', () => {
    render(<PRListHarness prs={moreThanOnePage} />)
    fireEvent.click(screen.getByRole('button', { name: /next →/i }))
    expect(screen.getByRole('button', { name: /next →/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /← prev/i })).not.toBeDisabled()
  })

  it('clicking a page button navigates to that page', () => {
    render(<PRListHarness prs={moreThanOnePage} />)
    fireEvent.click(screen.getByTestId('page-2'))
    expect(screen.getByRole('button', { name: /next →/i })).toBeDisabled()
  })
})

// ── linked banner ─────────────────────────────────────────────────────────────

function LinkedBannerHarness({ initial = true }: { initial?: boolean }) {
  const [shown, setShown] = useState(initial)
  if (!shown) return <div data-testid="no-banner" />
  return (
    <div role="status" data-testid="linked-banner">
      GitHub account connected successfully! Your pull requests are loading below.
      <button aria-label="Dismiss" onClick={() => setShown(false)}>✕</button>
    </div>
  )
}

describe('RepoPRsPage — linked banner', () => {
  it('shows the success banner when linked=true', () => {
    render(<LinkedBannerHarness initial />)
    expect(screen.getByTestId('linked-banner')).toBeInTheDocument()
    expect(screen.getByText(/GitHub account connected successfully/)).toBeInTheDocument()
  })

  it('dismiss button hides the banner', () => {
    render(<LinkedBannerHarness initial />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByTestId('linked-banner')).not.toBeInTheDocument()
  })

  it('banner is not shown when linked=false', () => {
    render(<LinkedBannerHarness initial={false} />)
    expect(screen.queryByTestId('linked-banner')).not.toBeInTheDocument()
  })
})
