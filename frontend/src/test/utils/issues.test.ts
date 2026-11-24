import { describe, it, expect } from 'vitest'
import { getOpenIssues, getIssueLoadError } from '../../utils/issues'
import type { AnalysisResult } from '../../api/analyze'

const baseResult: AnalysisResult = {
  owner: 'owner',
  repo: 'repo',
  status: 'completed',
  metadata: { stars: 0, forks: 0, open_issues: 0, language: null, topics: [], description: null, full_name: 'owner/repo' },
  tech_stack: [],
  directory_map: [],
}

describe('getOpenIssues', () => {
  it('returns empty array when issues is undefined', () => {
    expect(getOpenIssues(baseResult)).toEqual([])
  })

  it('filters out pull requests', () => {
    const result = {
      ...baseResult,
      issues: [
        { number: 1, title: 'Bug', body: null, state: 'open', labels: [], html_url: '', pull_request: { url: 'https://github.com/pr/1' } },
        { number: 2, title: 'Issue', body: null, state: 'open', labels: [], html_url: '' },
      ],
    }
    expect(getOpenIssues(result)).toHaveLength(1)
    expect(getOpenIssues(result)[0].number).toBe(2)
  })

  it('filters out closed issues', () => {
    const result = {
      ...baseResult,
      issues: [
        { number: 1, title: 'Open', body: null, state: 'open', labels: [], html_url: '' },
        { number: 2, title: 'Closed', body: null, state: 'closed', labels: [], html_url: '' },
      ],
    }
    expect(getOpenIssues(result)).toHaveLength(1)
    expect(getOpenIssues(result)[0].number).toBe(1)
  })
})

describe('getIssueLoadError', () => {
  it('returns null when issues are present', () => {
    const result = { ...baseResult, issues: [] }
    expect(getIssueLoadError(result)).toBeNull()
  })

  it('returns message when issues is undefined', () => {
    expect(getIssueLoadError(baseResult)).toBeTruthy()
  })

  it('returns error from failed issues step', () => {
    const result = {
      ...baseResult,
      issues: [],
      steps: [{ step: 'issues', status: 'error', data: { error: 'Rate limit exceeded' } }],
    }
    expect(getIssueLoadError(result)).toBe('Rate limit exceeded')
  })

  it('returns fallback message when step error has no message', () => {
    const result = {
      ...baseResult,
      issues: [],
      steps: [{ step: 'issues', status: 'error', data: {} }],
    }
    expect(getIssueLoadError(result)).toContain('GitHub issues could not be fetched')
  })
})
