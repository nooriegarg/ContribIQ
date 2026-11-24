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
})
