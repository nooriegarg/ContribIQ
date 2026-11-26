import { apiCall } from './client'

export interface LoginPayload {
  email: string
  password: string
  rememberMe: boolean
}

export interface LoginResponse {
  token: string
  refreshToken: string
  user: { id: string; email: string; name: string; github_username: string | null }
}

interface BackendLoginResponse {
  access_token: string
  token_type: string
  refresh_token: string
}

interface BackendUser {
  id: string
  email: string
  name: string | null
  github_username: string | null
  avatar_url: string | null
  created_at: string
}

export async function loginWithEmail(payload: LoginPayload): Promise<LoginResponse> {
  const data = await apiCall<BackendLoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: payload.email, password: payload.password }),
  })

  return getAuthenticatedUser(data.access_token, data.refresh_token)
}

async function getAuthenticatedUser(token: string,refreshToken : string): Promise<LoginResponse> {
  const me = await apiCall<BackendUser>('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  })

  return {
    token,
    refreshToken,
    user: {
      id: me.id,
      email: me.email,
      name: me.name ?? me.email.split('@')[0],
      github_username: me.github_username,
    },
  }
}

export async function registerWithEmail(payload: {
  email: string
  password: string
  name?: string
}): Promise<LoginResponse> {
  const data = await apiCall<BackendLoginResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  return getAuthenticatedUser(data.access_token, data.refresh_token)
}

export async function updateCurrentUser(payload: { name?: string; email?: string }): Promise<{ id: string; email: string; name: string; github_username: string | null }> {
  const data = await apiCall<BackendUser>('/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return {
    id: data.id,
    email: data.email,
    name: data.name ?? data.email.split('@')[0],
    github_username: data.github_username,
  }
}

export async function requestPasswordReset(_email: string): Promise<void> {
  void _email
  throw new Error('Password reset is currently unavailable.')
}

export function getGitHubOAuthUrl(): string {
  const base = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
  return `${base}/auth/github/login`
}

export function getGitHubLinkUrl(redirectPath?: string): string {
  const base = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
  const token = localStorage.getItem('token') ?? sessionStorage.getItem('token')
  const params = new URLSearchParams({ token: token ?? '' })
  if (redirectPath) params.set('redirect', redirectPath)
  return `${base}/auth/github/link?${params.toString()}`
}

export async function refreshMe(): Promise<{ id: string; email: string; name: string; github_username: string | null }> {
  const data = await apiCall<BackendUser>('/auth/me')
  return {
    id: data.id,
    email: data.email,
    name: data.name ?? data.email.split('@')[0],
    github_username: data.github_username,
  }
}
