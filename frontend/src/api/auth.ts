import { apiCall } from './client'

export interface LoginPayload {
  email: string
  password: string
  rememberMe: boolean
}

export interface LoginResponse {
  token: string
  user: { id: string; email: string; name: string }
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

  const me = await apiCall<BackendUser>('/auth/me', {
    headers: { Authorization: `Bearer ${data.access_token}` },
  })

  return {
    token: data.access_token,
    user: {
      id: me.id,
      email: me.email,
      name: me.name ?? me.email.split('@')[0],
    },
  }
}

export async function registerWithEmail(payload: {
  email: string
  password: string
  name?: string
}): Promise<LoginResponse> {
  const me = await apiCall<BackendUser>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

  const loginData = await apiCall<BackendLoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: payload.email, password: payload.password }),
  })

  return {
    token: loginData.access_token,
    user: {
      id: me.id,
      email: me.email,
      name: me.name ?? me.email.split('@')[0],
    },
  }
}

export async function requestPasswordReset(_email: string): Promise<void> {
  throw new Error('Password reset is currently unavailable.')
}

export function getGitHubOAuthUrl(): string {
  const base = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
  return `${base}/auth/github/login`
}
