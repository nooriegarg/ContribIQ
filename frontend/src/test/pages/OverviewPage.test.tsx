/**
 * Tests for OverviewPage rendering logic via a minimal harness.
 *
 * OverviewPage depends on ArchDiagram, QAPanel, RepoStats, TechStack, and
 * other components. We test its core logic via a harness that mirrors the
 * null-guard, repo-name resolution, issue-error alert, good-first-issue
 * count, and onboarding navigation without mounting the full page.
 *
 * Covers: null result guard, full_name vs owner/repo fallback, issue error
 * alert, good-first-issue label filter, non-PR open-issue-only filter,
 * goodFirstIssues suppressed on issue-load error, and navigation link.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { getIssueLoadError, getOpenIssues } from '../../utils/issues'
import type { AnalysisResult, RepositoryIssue } from '../../api/analyze'

// ── helpers ──────────────────────────────────────────────────────────────────

function makeResult(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    owner: 'org',
    repo: 'myrepo',
    status: 'completed',
    metadata: {
      full_name: 'org/myrepo',
      stars: 100,
      forks: 20,
      open_issues: 5,
      language: 'TypeScript',
      topics: [],
      description: 'A test repo',
    },
    tech_stack: [],
    directory_map: [],
    issues: [],
    ...overrides,
  } as AnalysisResult
}

function makeIssue(overrides: Partial<RepositoryIssue> = {}): RepositoryIssue {
  return {
    number: 1,
    title: 'Test issue',
    body: null,
    state: 'open',
    labels: [],
    html_url: 'https://github.com/org/repo/issues/1',
    ...overrides,
  }
}

interface HarnessProps {
  taskId?: string
  basePath?: string
  result: AnalysisResult | null
}

/**
 * Harness mirroring OverviewPage's null-guard, repo name resolution,
 * good-first-issue count, issue-load error, and navigation link.
 */
function OverviewHarness({ taskId = 'task-1', basePath = '/analysis/task-1', result }: HarnessProps) {
  if (!result) return null

  const { metadata } = result
  const name = metadata.full_name || `${result.owner}/${result.repo}`
  const issueError = getIssueLoadError(result)
  const goodFirstIssues = issueError
    ? null
    : getOpenIssues(result).filter(issue =>
        issue.labels.some(label => label.name.toLowerCase() === 'good first issue'),
      ).length

  return (
    <section>
      <h1 data-testid="subtitle">{name} - Repository analyzed</h1>
      {issueError && <p role="alert" data-testid="issue-error">{issueError}</p>}
      {goodFirstIssues !== null && (
        <p data-testid="gfi-count">Good first issues: {goodFirstIssues}</p>
      )}
      <a href={`${basePath}/onboarding`} data-testid="onboarding-link">
        Start Onboarding
      </a>
      <span data-testid="taskId">{taskId}</span>
    </section>
  )
}

// ── null guard ────────���───────────────────────────────────────────────────────

describe('OverviewPage — null guard', () => {
  it('renders nothing when result is null', () => {
    const { container } = render(<OverviewHarness result={null} />)
    expect(container).toBeEmptyDOMElement()
  })
})

// ── repo name ─────────────────────────────────────────────────────────────────

describe('OverviewPage — repo name', () => {
  it('uses metadata.full_name when present', () => {
    render(<OverviewHarness result={makeResult({ metadata: { ...makeResult().metadata, full_name: 'acme/widget' } })} />)
    expect(screen.getByTestId('subtitle')).toHaveTextContent('acme/widget')
  })

  it('falls back to owner/repo when full_name is empty', () => {
    render(<OverviewHarness result={makeResult({ owner: 'fallback-org', repo: 'fallback-repo', metadata: { ...makeResult().metadata, full_name: '' } })} />)
    expect(screen.getByTestId('subtitle')).toHaveTextContent('fallback-org/fallback-repo')
  })

  it('appends "Repository analyzed" to the repo name in the subtitle', () => {
    render(<OverviewHarness result={makeResult()} />)
    expect(screen.getByTestId('subtitle')).toHaveTextContent('Repository analyzed')
  })
})

// ── issue error ───────────────────────────────────────────────────────────────

describe('OverviewPage — issue error', () => {
  it('shows no alert when issues loaded successfully', () => {
    render(<OverviewHarness result={makeResult({ issues: [] })} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows error alert when issues step failed', () => {
    const result = makeResult({
      steps: [{ step: 'issues', status: 'error', data: { error: 'GitHub rate limit exceeded' } }],
      issues: undefined,
    })
    render(<OverviewHarness result={result} />)
    expect(screen.getByRole('alert')).toHaveTextContent('GitHub rate limit exceeded')
  })

  it('shows generic error message when no error detail is provided', () => {
    const result = makeResult({
      steps: [{ step: 'issues', status: 'error' }],
      issues: undefined,
    })
    render(<OverviewHarness result={result} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('shows "not included" error when issues is undefined and no step failure', () => {
    render(<OverviewHarness result={makeResult({ issues: undefined })} />)
    expect(screen.getByRole('alert')).toHaveTextContent(/did not include issue data/i)
  })
})

// ── good first issue count ────────────────────────────────────────────────────

describe('OverviewPage — good first issue count', () => {
  it('counts issues with "good first issue" label', () => {
    const issues = [
      makeIssue({ number: 1, labels: [{ name: 'good first issue' }] }),
      makeIssue({ number: 2, labels: [{ name: 'bug' }] }),
      makeIssue({ number: 3, labels: [{ name: 'good first issue' }, { name: 'help wanted' }] }),
    ]
    render(<OverviewHarness result={makeResult({ issues })} />)
    expect(screen.getByTestId('gfi-count')).toHaveTextContent('2')
  })

  it('returns 0 when no open issues have the good-first-issue label', () => {
    render(<OverviewHarness result={makeResult({ issues: [makeIssue({ labels: [{ name: 'bug' }] })] })} />)
    expect(screen.getByTestId('gfi-count')).toHaveTextContent('Good first issues: 0')
  })

  it('is case-insensitive when matching the label name', () => {
    const issues = [
      makeIssue({ labels: [{ name: 'Good First Issue' }] }),
      makeIssue({ number: 2, labels: [{ name: 'GOOD FIRST ISSUE' }] }),
    ]
    render(<OverviewHarness result={makeResult({ issues })} />)
    expect(screen.getByTestId('gfi-count')).toHaveTextContent('2')
  })

  it('excludes pull requests from the good-first-issue count', () => {
    const issues = [
      makeIssue({ number: 1, labels: [{ name: 'good first issue' }], pull_request: { url: 'https://...' } }),
      makeIssue({ number: 2, labels: [{ name: 'good first issue' }] }),
    ]
    render(<OverviewHarness result={makeResult({ issues })} />)
    expect(screen.getByTestId('gfi-count')).toHaveTextContent('1')
  })

  it('excludes closed issues from the good-first-issue count', () => {
    const issues = [
      makeIssue({ number: 1, labels: [{ name: 'good first issue' }], state: 'closed' }),
      makeIssue({ number: 2, labels: [{ name: 'good first issue' }], state: 'open' }),
    ]
    render(<OverviewHarness result={makeResult({ issues })} />)
    expect(screen.getByTestId('gfi-count')).toHaveTextContent('1')
  })

  it('suppresses the good-first-issue count when issues failed to load', () => {
    const result = makeResult({
      steps: [{ step: 'issues', status: 'error', data: { error: 'rate limit' } }],
      issues: undefined,
    })
    render(<OverviewHarness result={result} />)
    expect(screen.queryByTestId('gfi-count')).not.toBeInTheDocument()
  })
})

// ── navigation link ───────────────────────────────────────────────────────────

describe('OverviewPage — navigation', () => {
  it('shows "Start Onboarding" link to basePath/onboarding', () => {
    render(<OverviewHarness basePath="/analysis/t-99" result={makeResult()} />)
    const link = screen.getByTestId('onboarding-link')
    expect(link).toHaveTextContent('Start Onboarding')
    expect(link).toHaveAttribute('href', '/analysis/t-99/onboarding')
  })

  it('exposes taskId for use by child components', () => {
    render(<OverviewHarness taskId="task-nav" result={makeResult()} />)
    expect(screen.getByTestId('taskId')).toHaveTextContent('task-nav')
  })
})
