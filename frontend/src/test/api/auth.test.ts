import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockApiCall = vi.fn()
vi.mock('../../api/client', () => ({ apiCall: mockApiCall }))

describe('auth API', () => {
  beforeEach(() => {
    mockApiCall.mockReset()
  })

  describe('loginWithEmail', () => {
    it('returns token and user on success', async () => {
      mockApiCall
        .mockResolvedValueOnce({ access_token: 'tok', refresh_token: 'ref', token_type: 'bearer' })
        .mockResolvedValueOnce({ id: '1', email: 'a@b.com', name: 'Alice', github_username: null, avatar_url: null, created_at: '' })

      const { loginWithEmail } = await import('../../api/auth')
      const result = await loginWithEmail({ email: 'a@b.com', password: 'pass', rememberMe: false })

      expect(result.token).toBe('tok')
      expect(result.refreshToken).toBe('ref')
      expect(result.user.email).toBe('a@b.com')
      expect(result.user.name).toBe('Alice')
    })

    it('falls back to email prefix when name is null', async () => {
      mockApiCall
        .mockResolvedValueOnce({ access_token: 'tok', refresh_token: 'ref', token_type: 'bearer' })
        .mockResolvedValueOnce({ id: '1', email: 'user@example.com', name: null, github_username: null, avatar_url: null, created_at: '' })

      const { loginWithEmail } = await import('../../api/auth')
      const result = await loginWithEmail({ email: 'user@example.com', password: 'pass', rememberMe: false })
      expect(result.user.name).toBe('user')
    })
  })

  describe('registerWithEmail', () => {
    it('returns token and user on success', async () => {
      mockApiCall
        .mockResolvedValueOnce({ access_token: 'tok2', refresh_token: 'ref2', token_type: 'bearer' })
        .mockResolvedValueOnce({ id: '2', email: 'b@c.com', name: 'Bob', github_username: null, avatar_url: null, created_at: '' })

      const { registerWithEmail } = await import('../../api/auth')
      const result = await registerWithEmail({ email: 'b@c.com', password: 'pass', name: 'Bob' })
      expect(result.token).toBe('tok2')
      expect(result.user.name).toBe('Bob')
    })
  })

  describe('getGitHubOAuthUrl', () => {
    it('returns a URL containing /auth/github/login', async () => {
      const { getGitHubOAuthUrl } = await import('../../api/auth')
      expect(getGitHubOAuthUrl()).toContain('/auth/github/login')
    })
  })

  describe('requestPasswordReset', () => {
    it('always throws unavailable error', async () => {
      const { requestPasswordReset } = await import('../../api/auth')
      await expect(requestPasswordReset('a@b.com')).rejects.toThrow('unavailable')
    })
  })

  describe('getGitHubLinkUrl', () => {
    it('returns a URL containing /auth/github/link', async () => {
      const { getGitHubLinkUrl } = await import('../../api/auth')
      expect(getGitHubLinkUrl()).toContain('/auth/github/link')
    })

    it('appends redirect param when redirectPath is provided', async () => {
      const { getGitHubLinkUrl } = await import('../../api/auth')
      const url = getGitHubLinkUrl('/dashboard')
      expect(url).toContain('redirect=')
      expect(url).toContain('%2Fdashboard')
    })
  })

  describe('refreshMe', () => {
    it('calls /auth/me and returns mapped user', async () => {
      mockApiCall.mockResolvedValueOnce({ id: '1', email: 'a@b.com', name: 'Alice', github_username: 'alice-gh' })
      const { refreshMe } = await import('../../api/auth')
      const result = await refreshMe()
      expect(result.id).toBe('1')
      expect(result.email).toBe('a@b.com')
      expect(result.name).toBe('Alice')
      expect(result.github_username).toBe('alice-gh')
      expect(mockApiCall).toHaveBeenCalledWith('/auth/me')
    })

    it('falls back to email prefix when name is null', async () => {
      mockApiCall.mockResolvedValueOnce({ id: '2', email: 'user@example.com', name: null, github_username: null })
      const { refreshMe } = await import('../../api/auth')
      const result = await refreshMe()
      expect(result.name).toBe('user')
    })
  })

  describe('updateCurrentUser', () => {
    it('calls PATCH /auth/me and returns mapped user', async () => {
      mockApiCall.mockResolvedValueOnce({ id: '1', email: 'new@example.com', name: 'New Name' })

      const { updateCurrentUser } = await import('../../api/auth')
      const result = await updateCurrentUser({ name: 'New Name', email: 'new@example.com' })

      expect(result.id).toBe('1')
      expect(result.name).toBe('New Name')
      expect(result.email).toBe('new@example.com')
      expect(mockApiCall).toHaveBeenCalledWith(
        '/auth/me',
        expect.objectContaining({ method: 'PATCH' }),
      )
    })

    it('falls back to email prefix when name is null in response', async () => {
      mockApiCall.mockResolvedValueOnce({ id: '1', email: 'user@example.com', name: null })

      const { updateCurrentUser } = await import('../../api/auth')
      const result = await updateCurrentUser({ email: 'user@example.com' })
      expect(result.name).toBe('user')
    })

    it('propagates API error when request fails', async () => {
      mockApiCall.mockRejectedValueOnce(new Error('Email already in use'))

      const { updateCurrentUser } = await import('../../api/auth')
      await expect(updateCurrentUser({ email: 'taken@example.com' })).rejects.toThrow('Email already in use')
    })
  })
})
