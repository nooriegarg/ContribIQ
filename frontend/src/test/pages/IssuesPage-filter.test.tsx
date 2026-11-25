/**
 * Tests for IssuesPage filter, search, and sort logic.
 *
 * IssuesPage applies three operations on top of the raw issue list:
 *   1. Label filter — only issues whose labels include the selected label
 *   2. Text search — matches issue number, title, or body (strips leading '#')
 *   3. Match-score sort — issues with AI match data ranked highest first
 *
 * We test these via a minimal harness that replicates the same filter/sort
 * pipeline without mounting the full page and its router/workflow dependencies.
 */

import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import type { RepositoryIssue } from '../../api/analyze'
import type { IssueMatch } from '../../api/analyze'

// ── helpers ──────────────────────────────────────────────────────────────────

function makeIssue(partial: Partial<RepositoryIssue> & { number: number; title: string }): RepositoryIssue {
  return {
    state: 'open',
    body: null,
    labels: [],
    html_url: `https://github.com/owner/repo/issues/${partial.number}`,
    ...partial,
  }
}

function getOpenIssues(issues: RepositoryIssue[]) {
  return issues.filter(i => i.state === 'open' && !i.pull_request)
}

function applyFilters(
  issues: RepositoryIssue[],
  matchMap: Map<number, IssueMatch>,
  query: string,
  label: string,
): RepositoryIssue[] {
  const rankedIssues = [...issues].sort((a, b) => {
    const ma = matchMap.get(a.number)?.match_pct ?? -1
    const mb = matchMap.get(b.number)?.match_pct ?? -1
    return mb - ma
  })

  const search = query.trim().toLowerCase()
  return rankedIssues.filter(issue =>
    (!label || issue.labels.some(item => item.name === label))
    && (!search || `${issue.number} ${issue.title} ${issue.body ?? ''}`.toLowerCase().includes(search.replace(/^#(?=\d)/, ''))),
  )
}

// ── minimal harness ───────────────────────────────────────────────────────────

function FilterHarness({
  issues,
  matches = [],
}: {
  issues: RepositoryIssue[]
  matches?: IssueMatch[]
}) {
  const [query, setQuery] = useState('')
  const [label, setLabel] = useState('')

  const openIssues = getOpenIssues(issues)
  const matchMap = new Map(matches.map(m => [m.issue_number, m]))
  const labels = [...new Set(openIssues.flatMap(i => i.labels.map(l => l.name)))].sort()
  const filtered = applyFilters(openIssues, matchMap, query, label)

  return (
    <div>
      <input
        aria-label="search"
        type="search"
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Search issues"
      />
      <select aria-label="label-filter" value={label} onChange={e => setLabel(e.target.value)}>
        <option value="">All labels</option>
        {labels.map(name => <option value={name} key={name}>{name}</option>)}
      </select>
      {(query || label) && (
        <button onClick={() => { setQuery(''); setLabel('') }}>Clear filters</button>
      )}
      <p data-testid="count">{filtered.length} issues shown</p>
      <ul>
        {filtered.map(issue => (
          <li key={issue.number} data-testid={`issue-${issue.number}`}>
            #{issue.number} {issue.title}
            {matchMap.has(issue.number) && (
              <span data-testid={`match-${issue.number}`}>{matchMap.get(issue.number)!.match_pct}%</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── tests ─────────────────────────────────────────────────────────────────────

const BASE_ISSUES: RepositoryIssue[] = [
  makeIssue({ number: 1, title: 'Fix login bug', labels: [{ name: 'bug' }], body: 'Auth is broken' }),
  makeIssue({ number: 2, title: 'Add dark mode', labels: [{ name: 'enhancement' }], body: 'UI request' }),
  makeIssue({ number: 3, title: 'Update docs', labels: [{ name: 'documentation' }], body: null }),
  makeIssue({ number: 4, title: 'Refactor API', labels: [{ name: 'bug' }, { name: 'backend' }], body: 'Cleanup needed' }),
]

const BASE_MATCHES: IssueMatch[] = [
  { issue_number: 2, match_pct: 90, reasons: ['React skills match'] },
  { issue_number: 1, match_pct: 60, reasons: ['Familiar with auth'] },
  { issue_number: 4, match_pct: 30, reasons: ['Backend experience'] },
]

describe('IssuesPage — initial render', () => {
  it('shows all open issues by default', () => {
    render(<FilterHarness issues={BASE_ISSUES} />)
    expect(screen.getByTestId('count').textContent).toBe('4 issues shown')
  })

  it('excludes pull requests from the issue list', () => {
    const withPR = [
      ...BASE_ISSUES,
      makeIssue({ number: 99, title: 'PR that looks like issue', pull_request: { url: 'https://example.com' } }),
    ]
    render(<FilterHarness issues={withPR} />)
    expect(screen.getByTestId('count').textContent).toBe('4 issues shown')
    expect(screen.queryByTestId('issue-99')).not.toBeInTheDocument()
  })

  it('excludes closed issues', () => {
    const withClosed = [
      ...BASE_ISSUES,
      makeIssue({ number: 50, title: 'Already resolved', state: 'closed' }),
    ]
    render(<FilterHarness issues={withClosed} />)
    expect(screen.getByTestId('count').textContent).toBe('4 issues shown')
  })
})

describe('IssuesPage — label filter', () => {
  it('filters to only issues with the selected label', () => {
    render(<FilterHarness issues={BASE_ISSUES} />)
    fireEvent.change(screen.getByRole('combobox', { name: /label-filter/i }), { target: { value: 'bug' } })

    expect(screen.getByTestId('count').textContent).toBe('2 issues shown')
    expect(screen.getByTestId('issue-1')).toBeInTheDocument()
    expect(screen.getByTestId('issue-4')).toBeInTheDocument()
    expect(screen.queryByTestId('issue-2')).not.toBeInTheDocument()
  })

  it('shows all issues when "All labels" is selected', () => {
    render(<FilterHarness issues={BASE_ISSUES} />)
    const select = screen.getByRole('combobox', { name: /label-filter/i })
    fireEvent.change(select, { target: { value: 'bug' } })
    fireEvent.change(select, { target: { value: '' } })

    expect(screen.getByTestId('count').textContent).toBe('4 issues shown')
  })

  it('populates the label dropdown with unique labels sorted alphabetically', () => {
    render(<FilterHarness issues={BASE_ISSUES} />)
    const options = screen.getAllByRole('option').map(o => o.textContent)
    expect(options).toEqual(['All labels', 'backend', 'bug', 'documentation', 'enhancement'])
  })
})

describe('IssuesPage — text search', () => {
  it('filters by issue title (case-insensitive)', () => {
    render(<FilterHarness issues={BASE_ISSUES} />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'dark mode' } })

    expect(screen.getByTestId('count').textContent).toBe('1 issues shown')
    expect(screen.getByTestId('issue-2')).toBeInTheDocument()
  })

  it('filters by issue body text', () => {
    render(<FilterHarness issues={BASE_ISSUES} />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'auth is broken' } })

    expect(screen.getByTestId('issue-1')).toBeInTheDocument()
    expect(screen.getByTestId('count').textContent).toBe('1 issues shown')
  })

  it('filters by issue number when prefixed with #', () => {
    render(<FilterHarness issues={BASE_ISSUES} />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '#3' } })

    expect(screen.getByTestId('issue-3')).toBeInTheDocument()
    expect(screen.getByTestId('count').textContent).toBe('1 issues shown')
  })

  it('filters by bare issue number without # prefix', () => {
    render(<FilterHarness issues={BASE_ISSUES} />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: '2' } })

    expect(screen.getByTestId('count').textContent).toBe('1 issues shown')
    expect(screen.getByTestId('issue-2')).toBeInTheDocument()
  })

  it('shows zero results when search matches nothing', () => {
    render(<FilterHarness issues={BASE_ISSUES} />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz-no-match' } })
    expect(screen.getByTestId('count').textContent).toBe('0 issues shown')
  })
})

describe('IssuesPage — combined label + search filter', () => {
  it('applies label and search filters together', () => {
    render(<FilterHarness issues={BASE_ISSUES} />)
    fireEvent.change(screen.getByRole('combobox', { name: /label-filter/i }), { target: { value: 'bug' } })
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'login' } })

    expect(screen.getByTestId('count').textContent).toBe('1 issues shown')
    expect(screen.getByTestId('issue-1')).toBeInTheDocument()
  })
})

describe('IssuesPage — clear filters', () => {
  it('shows clear button when a filter is active', () => {
    render(<FilterHarness issues={BASE_ISSUES} />)
    expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument()

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'login' } })
    expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument()
  })

  it('restores all issues after clearing filters', () => {
    render(<FilterHarness issues={BASE_ISSUES} />)
    fireEvent.change(screen.getByRole('combobox', { name: /label-filter/i }), { target: { value: 'bug' } })
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'login' } })

    fireEvent.click(screen.getByRole('button', { name: /clear filters/i }))

    expect(screen.getByTestId('count').textContent).toBe('4 issues shown')
    expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument()
  })
})

describe('IssuesPage — match-score sort', () => {
  it('shows the highest-match issue first', () => {
    render(<FilterHarness issues={BASE_ISSUES} matches={BASE_MATCHES} />)
    const items = screen.getAllByRole('listitem')

    expect(items[0].textContent).toContain('#2')
    expect(items[0].textContent).toContain('90%')
  })

  it('places unscored issues after scored ones', () => {
    render(<FilterHarness issues={BASE_ISSUES} matches={BASE_MATCHES} />)
    const items = screen.getAllByRole('listitem')

    expect(items[items.length - 1].textContent).toContain('#3')
    expect(screen.queryByTestId('match-3')).not.toBeInTheDocument()
  })

  it('sorts all scored issues by descending match_pct', () => {
    render(<FilterHarness issues={BASE_ISSUES} matches={BASE_MATCHES} />)
    const items = screen.getAllByRole('listitem')
    const numbers = items.map(li => Number(li.textContent!.match(/#(\d+)/)![1]))

    expect(numbers).toEqual([2, 1, 4, 3])
  })
})
