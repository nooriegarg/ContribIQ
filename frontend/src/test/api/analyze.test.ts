import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockApiCall = vi.fn()
vi.mock('../../api/client', () => ({ apiCall: mockApiCall }))

describe('analyze API', () => {
  beforeEach(() => {
    mockApiCall.mockReset()
  })

  describe('startAnalysis', () => {
    it('returns task_id on success', async () => {
      mockApiCall.mockResolvedValueOnce({ task_id: 'abc-123' })
      const { startAnalysis } = await import('../../api/analyze')
      const result = await startAnalysis({ owner: 'org', repo: 'repo' })
      expect(result.task_id).toBe('abc-123')
      expect(mockApiCall).toHaveBeenCalledWith('/analysis/start', expect.objectContaining({ method: 'POST' }))
    })
  })

  describe('getAnalysisResult', () => {
    it('calls correct endpoint', async () => {
      const fakeResult = { status: 'completed', owner: 'org', repo: 'repo' }
      mockApiCall.mockResolvedValueOnce(fakeResult)
      const { getAnalysisResult } = await import('../../api/analyze')
      const result = await getAnalysisResult('task-1')
      expect(result).toEqual(fakeResult)
      expect(mockApiCall).toHaveBeenCalledWith('/analysis/result/task-1')
    })
  })

  describe('getMatchedIssues', () => {
    it('calls correct endpoint', async () => {
      const fakeMatches = [
        { issue_number: 42, match_pct: 85, reasons: ['Matches Python skills', 'Good first issue', 'Small scope'] },
        { issue_number: 7, match_pct: 60, reasons: ['Matches TypeScript', 'Backend interest', 'Medium difficulty'] },
      ]
      mockApiCall.mockResolvedValueOnce(fakeMatches)
      const { getMatchedIssues } = await import('../../api/analyze')
      const result = await getMatchedIssues('task-1')
      expect(result).toEqual(fakeMatches)
      expect(mockApiCall).toHaveBeenCalledWith('/analysis/result/task-1/matches')
    })

    it('returns empty array when no matches', async () => {
      mockApiCall.mockResolvedValueOnce([])
      const { getMatchedIssues } = await import('../../api/analyze')
      const result = await getMatchedIssues('task-1')
      expect(result).toEqual([])
    })
  })

  describe('getIssueDetail', () => {
    it('calls correct endpoint with owner and repo query params', async () => {
      const fakeDetail = {
        number: 42,
        title: 'Fix auth bug',
        body: 'The login flow breaks on timeout.',
        url: 'https://github.com/org/repo/issues/42',
        labels: ['bug'],
        difficulty: 2,
        explanation: 'The auth token expires silently.',
        files_affected: [{ path: 'src/auth.ts', role: 'Primary file to change' }],
        prerequisites: [{ title: 'Read README', description: 'Understand setup.' }],
        impact_chain: ['AuthService', 'API', 'Database'],
        similar_prs: [{ number: 10, title: 'Fix session handling', url: 'https://github.com/org/repo/pull/10' }],
        checklist: [{ step: 'Reproduce the bug locally' }],
      }
      mockApiCall.mockResolvedValueOnce(fakeDetail)
      const { getIssueDetail } = await import('../../api/analyze')
      const result = await getIssueDetail('org', 'repo', 42)
      expect(result).toEqual(fakeDetail)
      expect(mockApiCall).toHaveBeenCalledWith('/issues/42/detail?owner=org&repo=repo')
    })

    it('URL-encodes owner and repo containing special characters', async () => {
      mockApiCall.mockResolvedValueOnce({})
      const { getIssueDetail } = await import('../../api/analyze')
      await getIssueDetail('my org', 'my repo', 1)
      expect(mockApiCall).toHaveBeenCalledWith('/issues/1/detail?owner=my%20org&repo=my%20repo')
    })

    it('propagates errors from apiCall', async () => {
      mockApiCall.mockRejectedValueOnce(new Error('Not found'))
      const { getIssueDetail } = await import('../../api/analyze')
      await expect(getIssueDetail('org', 'repo', 99)).rejects.toThrow('Not found')
    })
  })

  describe('getReadinessScore', () => {
    it('calls correct endpoint with taskId and issueNumber', async () => {
      const fakeScore = {
        overall: 72,
        dimensions: [
          { key: 'repository_understanding', label: 'Repository Understanding', score: 80, weight: 0.25 },
          { key: 'environment_setup', label: 'Environment Setup', score: 100, weight: 0.2 },
          { key: 'code_understanding', label: 'Code Understanding', score: 70, weight: 0.25 },
          { key: 'testing_knowledge', label: 'Testing Knowledge', score: 60, weight: 0.15 },
          { key: 'issue_understanding', label: 'Issue Understanding', score: 30, weight: 0.15 },
        ],
      }
      mockApiCall.mockResolvedValueOnce(fakeScore)
      const { getReadinessScore } = await import('../../api/analyze')
      const result = await getReadinessScore('task-abc', 42)
      expect(result).toEqual(fakeScore)
      expect(mockApiCall).toHaveBeenCalledWith('/analysis/result/task-abc/readiness/42')
    })

    it('returns overall score as a number', async () => {
      mockApiCall.mockResolvedValueOnce({ overall: 55, dimensions: [] })
      const { getReadinessScore } = await import('../../api/analyze')
      const result = await getReadinessScore('task-xyz', 7)
      expect(typeof result.overall).toBe('number')
    })

    it('propagates errors from apiCall', async () => {
      mockApiCall.mockRejectedValueOnce(new Error('Unauthorized'))
      const { getReadinessScore } = await import('../../api/analyze')
      await expect(getReadinessScore('task-abc', 1)).rejects.toThrow('Unauthorized')
    })
  })
})
