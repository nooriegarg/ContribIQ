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

  describe('getGeneratedIssues', () => {
    it('calls correct endpoint', async () => {
      const fakeIssues = [
        {
          title: 'Add docstring to user_service.py',
          description: 'The function is missing documentation.',
          files_affected: ['backend/services/user_service.py'],
          skills: ['Python'],
          difficulty: 1.5,
          estimated_hours: 0.5,
          why_beginner_friendly: 'No logic change required, just documentation.',
          gap_kind: 'missing_docstring',
          source: 'ai_generated',
        },
      ]
      mockApiCall.mockResolvedValueOnce(fakeIssues)
      const { getGeneratedIssues } = await import('../../api/analyze')
      const result = await getGeneratedIssues('task-1')
      expect(result).toEqual(fakeIssues)
      expect(mockApiCall).toHaveBeenCalledWith('/analysis/result/task-1/generated-issues')
    })

    it('returns empty array when no generated issues exist', async () => {
      mockApiCall.mockResolvedValueOnce([])
      const { getGeneratedIssues } = await import('../../api/analyze')
      const result = await getGeneratedIssues('task-1')
      expect(result).toEqual([])
    })

    it('propagates errors from apiCall', async () => {
      mockApiCall.mockRejectedValueOnce(new Error('Analysis not found'))
      const { getGeneratedIssues } = await import('../../api/analyze')
      await expect(getGeneratedIssues('bad-task')).rejects.toThrow('Analysis not found')
    })
  })

  describe('getSimilarRepos', () => {
    it('calls correct endpoint and returns repo list', async () => {
      const fakeRepos = [
        {
          full_name: 'org/awesome-project',
          description: 'A great project',
          stars: 1234,
          language: 'TypeScript',
          topics: ['react', 'web'],
          html_url: 'https://github.com/org/awesome-project',
          open_issues: 5,
        },
      ]
      mockApiCall.mockResolvedValueOnce(fakeRepos)
      const { getSimilarRepos } = await import('../../api/analyze')
      const result = await getSimilarRepos('task-1')
      expect(result).toEqual(fakeRepos)
      expect(mockApiCall).toHaveBeenCalledWith('/analysis/result/task-1/similar-repos')
    })

    it('returns empty array when no similar repos found', async () => {
      mockApiCall.mockResolvedValueOnce([])
      const { getSimilarRepos } = await import('../../api/analyze')
      const result = await getSimilarRepos('task-1')
      expect(result).toEqual([])
    })

    it('propagates errors from apiCall', async () => {
      mockApiCall.mockRejectedValueOnce(new Error('Not found'))
      const { getSimilarRepos } = await import('../../api/analyze')
      await expect(getSimilarRepos('bad-task')).rejects.toThrow('Not found')
    })
  })

  describe('subscribeToProgress', () => {
    const mockFetch = vi.fn()

    beforeEach(() => {
      vi.stubGlobal('fetch', mockFetch)
      mockFetch.mockReset()
    })

    function makeStream(chunks: string[]) {
      let idx = 0
      const encoder = new TextEncoder()
      return {
        ok: true,
        status: 200,
        body: {
          getReader: () => ({
            read: vi.fn().mockImplementation(() => {
              if (idx < chunks.length) {
                return Promise.resolve({ value: encoder.encode(chunks[idx++]), done: false })
              }
              return Promise.resolve({ value: undefined, done: true })
            }),
            cancel: vi.fn().mockResolvedValue(undefined),
          }),
        },
      }
    }

    it('calls onProgress for progress events and onDone for done event', async () => {
      const progressPayload = { step: 'fetching', status: 'running' }
      const donePayload = { status: 'completed', owner: 'org', repo: 'repo', metadata: { full_name: 'org/repo', stars: 0, forks: 0, open_issues: 0, language: null, topics: [], description: null }, tech_stack: [], directory_map: [] }
      const chunks = [
        `event: progress\ndata: ${JSON.stringify(progressPayload)}\n\n`,
        `event: done\ndata: ${JSON.stringify(donePayload)}\n\n`,
      ]
      mockFetch.mockResolvedValueOnce(makeStream(chunks))
      const onProgress = vi.fn()
      const onDone = vi.fn()
      const onError = vi.fn()
      const { subscribeToProgress } = await import('../../api/analyze')
      subscribeToProgress('task-1', onProgress, onDone, onError)
      await new Promise(r => setTimeout(r, 50))
      expect(onProgress).toHaveBeenCalledWith(progressPayload)
      expect(onDone).toHaveBeenCalledWith(donePayload)
      expect(onError).not.toHaveBeenCalled()
    })

    it('calls onError when fetch returns 401', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401, body: null })
      const onError = vi.fn()
      const { subscribeToProgress } = await import('../../api/analyze')
      subscribeToProgress('task-1', vi.fn(), vi.fn(), onError)
      await new Promise(r => setTimeout(r, 50))
      expect(onError).toHaveBeenCalledWith(expect.stringContaining('session'))
    })

    it('calls onError when event is error type', async () => {
      const chunks = [`event: error\ndata: ${JSON.stringify({ error: 'Pipeline failed' })}\n\n`]
      mockFetch.mockResolvedValueOnce(makeStream(chunks))
      const onError = vi.fn()
      const { subscribeToProgress } = await import('../../api/analyze')
      subscribeToProgress('task-1', vi.fn(), vi.fn(), onError)
      await new Promise(r => setTimeout(r, 50))
      expect(onError).toHaveBeenCalledWith('Pipeline failed')
    })

    it('returns an AbortController', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500, body: null })
      const { subscribeToProgress } = await import('../../api/analyze')
      const controller = subscribeToProgress('task-1', vi.fn(), vi.fn(), vi.fn())
      expect(controller).toBeInstanceOf(AbortController)
      controller.abort()
    })
  })
})
