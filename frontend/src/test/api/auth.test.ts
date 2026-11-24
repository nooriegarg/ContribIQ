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
})
