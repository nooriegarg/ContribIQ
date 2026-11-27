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

  it('uses sessionStorage token when localStorage has no token', async () => {
    sessionStorage.setItem('token', 'session-token')
    mockFetch.mockResolvedValueOnce(mockResponse({}))
    const { apiCall } = await import('../../api/client')
    await apiCall('/test')
    const headers = mockFetch.mock.calls[0][1].headers as Headers
    expect(headers.get('Authorization')).toBe('Bearer session-token')
  })

  it('retries with new token after 401 and successful refresh', async () => {
    localStorage.setItem('token', 'old-token')
    localStorage.setItem('refreshToken', 'refresh-token')
    mockFetch
      .mockResolvedValueOnce(mockResponse({}, 401))
      .mockResolvedValueOnce(mockResponse({ access_token: 'new-token' }))
      .mockResolvedValueOnce(mockResponse({ data: 'retried' }))
    const { apiCall } = await import('../../api/client')
    const result = await apiCall('/protected')
    expect(result).toEqual({ data: 'retried' })
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })

  it('clears tokens and redirects when refresh returns no access_token', async () => {
    localStorage.setItem('token', 'old-token')
    localStorage.setItem('refreshToken', 'refresh-token')
    Object.defineProperty(window, 'location', { value: { href: '' }, writable: true })
    mockFetch
      .mockResolvedValueOnce(mockResponse({}, 401))
      .mockResolvedValueOnce(mockResponse({}))
    const { apiCall } = await import('../../api/client')
    await expect(apiCall('/protected')).rejects.toThrow('Session expired')
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('skips refresh for auth endpoints on 401', async () => {
    localStorage.setItem('token', 'token')
    localStorage.setItem('refreshToken', 'refresh')
    mockFetch.mockResolvedValueOnce(mockResponse({ detail: 'Bad credentials' }, 401))
    const { apiCall } = await import('../../api/client')
    await expect(apiCall('/auth/login')).rejects.toThrow('Bad credentials')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('does not retry when no refreshToken exists on 401', async () => {
    localStorage.setItem('token', 'old-token')
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({}) })
    const { apiCall } = await import('../../api/client')
    await expect(apiCall('/protected')).rejects.toThrow('Session expired')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('does not override Content-Type when already set in options', async () => {
    mockFetch.mockResolvedValueOnce(mockResponse({}))
    const { apiCall } = await import('../../api/client')
    await apiCall('/test', { headers: { 'Content-Type': 'multipart/form-data' } })
    const headers = mockFetch.mock.calls[0][1].headers as Headers
    expect(headers.get('Content-Type')).toBe('multipart/form-data')
  })

  it('handles token refresh failure when refresh endpoint returns non-ok', async () => {
    localStorage.setItem('token', 'old-token')
    localStorage.setItem('refreshToken', 'bad-refresh')
    mockFetch
      .mockResolvedValueOnce(mockResponse({}, 401))
      .mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({}) })
    const { apiCall } = await import('../../api/client')
    await expect(apiCall('/protected')).rejects.toThrow()
  })
})
