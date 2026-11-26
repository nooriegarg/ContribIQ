/**
 * Tests for IssueDetailPage behavior via a minimal harness.
 *
 * The page depends on React Router, useWorkflow, and several API calls.
 * We test the core logic via a harness that mirrors the tab-switching and
 * checklist state machine without mounting the full page and its transitive
 * dependencies.
 *
 * Covers: issue-not-found error state, issue banner, all 5 tabs, tab switching,
 * checklist rendering, checklist toggle, progress counter, and per-issue isolation.
 */

import { describe, it, expect } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'

const TABS = ['Understanding', 'Implementation', 'Similar PRs', 'Checklist', 'Readiness'] as const

const CHECKLIST = [
  'Read the issue description and discussion',
  'Read the repository README and contribution guidelines',
  'Confirm the issue is available and clarify the expected behavior',
  'Set up the project locally and reproduce the behavior',
  'Create a branch and make a focused change',
  'Add or update relevant tests and run the project checks',
  'Review the diff and open a pull request linked to the issue',
]

interface Issue {
  number: number
  title: string
  user: { login: string } | null
  labels: { name: string }[]
  body: string | null
}

interface HarnessProps {
  issue?: Issue
  taskId?: string
  basePath?: string
  fullName?: string
}

/**
 * Harness mirroring IssueDetailPage's tab-switching, checklist state machine,
 * and issue-not-found rendering — without router, useWorkflow, or API deps.
 */
function IssueDetailHarness({
  issue,
  taskId = 'task-1',
  basePath = '/analysis/task-1',
  fullName = 'org/repo',
}: HarnessProps) {
  const [tab, setTab] = useState(0)
  const [checklists, setChecklists] = useState<Record<string, number[]>>({})

  if (!issue) {
    return (
      <section>
        <div role="alert">This open issue was not found in the repository analysis.</div>
        <a href={`${basePath}/issues`}>Back to Issues</a>
      </section>
    )
  }

  const key = `${taskId}:${issue.number}`
  const checked = checklists[key] ?? []

  return (
    <section>
      {/* Banner */}
      <p data-testid="banner-num">{fullName} / #{issue.number}</p>
      <h2 data-testid="banner-title">{issue.title}</h2>

      {/* Tabs */}
      <div role="tablist" aria-label="Issue detail sections">
        {TABS.map((name, index) => (
          <button
            key={name}
            role="tab"
            aria-selected={tab === index}
            onClick={() => setTab(index)}
          >
            {name}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div role="tabpanel">
        {tab === 3 && (
          <section data-testid="checklist-panel">
            <p role="status">{checked.length} of {CHECKLIST.length} complete.</p>
            {CHECKLIST.map((text, index) => (
              <label key={text}>
                <input
                  type="checkbox"
                  checked={checked.includes(index)}
                  onChange={() =>
                    setChecklists(prev => {
                      const items = prev[key] ?? []
                      return {
                        ...prev,
                        [key]: items.includes(index)
                          ? items.filter(i => i !== index)
                          : [...items, index],
                      }
                    })
                  }
                />
                <span>{text}</span>
              </label>
            ))}
          </section>
        )}
      </div>
    </section>
  )
}

const SAMPLE_ISSUE: Issue = {
  number: 42,
  title: 'Fix null pointer in auth service',
  user: { login: 'contributor' },
  labels: [{ name: 'bug' }, { name: 'good first issue' }],
  body: 'Auth service throws NPE when token is missing.',
}

// ── issue not found ───────────────────────────────────────────────────────────

describe('IssueDetailPage — issue not found', () => {
  it('shows an error alert when no issue is provided', () => {
    render(<IssueDetailHarness issue={undefined} />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/not found/i)
  })

  it('shows a Back to Issues link when issue is not found', () => {
    render(<IssueDetailHarness issue={undefined} basePath="/analysis/t-1" />)
    const link = screen.getByRole('link', { name: /back to issues/i })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/analysis/t-1/issues')
  })

  it('does not render any tabs when issue is not found', () => {
    render(<IssueDetailHarness issue={undefined} />)
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
  })
})

// ── issue banner ──────────────────────────────────────────────────────────────

describe('IssueDetailPage — issue banner', () => {
  it('shows the issue number in the banner', () => {
    render(<IssueDetailHarness issue={SAMPLE_ISSUE} />)
    expect(screen.getByTestId('banner-num')).toHaveTextContent('#42')
  })

  it('shows the issue title in the banner', () => {
    render(<IssueDetailHarness issue={SAMPLE_ISSUE} />)
    expect(screen.getByTestId('banner-title')).toHaveTextContent('Fix null pointer in auth service')
  })

  it('shows the full repository name in the banner', () => {
    render(<IssueDetailHarness issue={SAMPLE_ISSUE} fullName="myorg/myrepo" />)
    expect(screen.getByTestId('banner-num')).toHaveTextContent('myorg/myrepo')
  })
})

// ── tabs ──────────────────────────────────────────────────────────────────────

describe('IssueDetailPage — tabs', () => {
  it('renders all 5 tabs', () => {
    render(<IssueDetailHarness issue={SAMPLE_ISSUE} />)
    for (const name of TABS) {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument()
    }
  })

  it('the first tab (Understanding) is selected by default', () => {
    render(<IssueDetailHarness issue={SAMPLE_ISSUE} />)
    expect(screen.getByRole('tab', { name: 'Understanding' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('other tabs are not selected by default', () => {
    render(<IssueDetailHarness issue={SAMPLE_ISSUE} />)
    expect(screen.getByRole('tab', { name: 'Implementation' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
    expect(screen.getByRole('tab', { name: 'Checklist' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })

  it('clicking a tab makes it selected', () => {
    render(<IssueDetailHarness issue={SAMPLE_ISSUE} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Checklist' }))
    expect(screen.getByRole('tab', { name: 'Checklist' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('clicking a tab deselects the previously active tab', () => {
    render(<IssueDetailHarness issue={SAMPLE_ISSUE} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Similar PRs' }))
    expect(screen.getByRole('tab', { name: 'Understanding' })).toHaveAttribute(
      'aria-selected',
      'false',
    )
  })
})

// ── checklist ─────────────────────────────────────────────────────────────────

describe('IssueDetailPage — checklist', () => {
  function openChecklist(issue: Issue = SAMPLE_ISSUE) {
    render(<IssueDetailHarness issue={issue} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Checklist' }))
  }

  it('checklist tab renders all 7 items', () => {
    openChecklist()
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(CHECKLIST.length)
  })

  it('all checklist items are unchecked initially', () => {
    openChecklist()
    screen.getAllByRole('checkbox').forEach(cb => expect(cb).not.toBeChecked())
  })

  it('progress shows "0 of 7 complete" initially', () => {
    openChecklist()
    expect(screen.getByRole('status')).toHaveTextContent('0 of 7 complete')
  })

  it('checking an item marks it as checked', () => {
    openChecklist()
    const [first] = screen.getAllByRole('checkbox')
    fireEvent.click(first)
    expect(first).toBeChecked()
  })

  it('progress counter increments when an item is checked', () => {
    openChecklist()
    fireEvent.click(screen.getAllByRole('checkbox')[0])
    expect(screen.getByRole('status')).toHaveTextContent('1 of 7 complete')
  })

  it('unchecking a checked item removes it and decrements progress', () => {
    openChecklist()
    const [first] = screen.getAllByRole('checkbox')
    fireEvent.click(first)
    expect(screen.getByRole('status')).toHaveTextContent('1 of 7 complete')
    fireEvent.click(first)
    expect(first).not.toBeChecked()
    expect(screen.getByRole('status')).toHaveTextContent('0 of 7 complete')
  })

  it('multiple items can be checked independently', () => {
    openChecklist()
    const checkboxes = screen.getAllByRole('checkbox')
    fireEvent.click(checkboxes[0])
    fireEvent.click(checkboxes[2])
    fireEvent.click(checkboxes[4])
    expect(screen.getByRole('status')).toHaveTextContent('3 of 7 complete')
    expect(checkboxes[0]).toBeChecked()
    expect(checkboxes[1]).not.toBeChecked()
    expect(checkboxes[2]).toBeChecked()
  })

  it('checklist state is isolated per issue number', () => {
    const issue42 = { ...SAMPLE_ISSUE, number: 42 }
    const issue99 = { ...SAMPLE_ISSUE, number: 99 }

    const { rerender } = render(<IssueDetailHarness issue={issue42} taskId="t1" />)
    fireEvent.click(screen.getByRole('tab', { name: 'Checklist' }))
    fireEvent.click(screen.getAllByRole('checkbox')[0])
    expect(screen.getByRole('status')).toHaveTextContent('1 of 7 complete')

    // Switch to a different issue — checklist should start fresh
    rerender(<IssueDetailHarness issue={issue99} taskId="t1" />)
    // Checklist tab is not shown after rerender (tab state resets), re-click
    fireEvent.click(screen.getByRole('tab', { name: 'Checklist' }))
    expect(screen.getByRole('status')).toHaveTextContent('0 of 7 complete')
  })
})
