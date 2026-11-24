import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function mockResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })
}

describe('apiCall', () => {
  beforeEach(() => {
    mockFetch.mockReset()
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.resetModules()
  })

  it('makes a GET request and returns parsed JSON', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ data: 'ok' }))
    const { apiCall } = await import('../../api/client')
    const result = await apiCall('/test')
    expect(result).toEqual({ data: 'ok' })
    expect(mockFetch).toHaveBeenCalledOnce()
  })

  it('sets Content-Type to application/json by default', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({}))
    const { apiCall } = await import('../../api/client')
    await apiCall('/test')
    const headers = mockFetch.mock.calls[0][1].headers as Headers
    expect(headers.get('Content-Type')).toBe('application/json')
  })

  it('attaches Authorization header when token exists in localStorage', async () => {
    localStorage.setItem('token', 'test-token')
    mockFetch.mockResolvedValueOnce(mockResponse({}))
    const { apiCall } = await import('../../api/client')
    await apiCall('/test')
    const headers = mockFetch.mock.calls[0][1].headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer test-token')
  })

  it('throws with detail message on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({ detail: 'Not found' }, 404))
    const { apiCall } = await import('../../api/client')
    await expect(apiCall('/test')).rejects.toThrow('Not found')
  })

  it('throws with HTTP status fallback when no detail', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    })
    const { apiCall } = await import('../../api/client')
    await expect(apiCall('/test')).rejects.toThrow('HTTP 500')
  })
})
