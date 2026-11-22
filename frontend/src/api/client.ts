/**
 * Base API client for ContribIQ.
 */

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

function getToken(): string | null {
  return localStorage.getItem('token') ?? sessionStorage.getItem('token')
}

function clearTokens(): void {
  localStorage.removeItem('token')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('user')
  sessionStorage.removeItem('token')
  sessionStorage.removeItem('refreshToken')
  sessionStorage.removeItem('user')
}

async function refreshAccessToken(storage: Storage, refreshToken: string): Promise<string | null> {
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  if (!response.ok) return null

  const data = (await response.json()) as { access_token?: string }
  if (!data.access_token || storage.getItem('refreshToken') !== refreshToken) {
    return null
  }

  storage.setItem('token', data.access_token)
  window.dispatchEvent(new Event('auth:token-refreshed'))
  return data.access_token
}

export async function apiCall<T>(path: string, options: RequestInit = {}): Promise<T> {
  const storage = localStorage.getItem('token') ? localStorage : sessionStorage
  const token = getToken()
  const refreshToken = storage.getItem('refreshToken')
  const headers = new Headers(options.headers)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  const isAuthRequest = ['/auth/login', '/auth/register', '/auth/refresh'].includes(path)
  const usedSessionToken = token && headers.get('Authorization') === `Bearer ${token}`

  if (res.status === 401 && usedSessionToken && !isAuthRequest) {
    const newToken = refreshToken ? await refreshAccessToken(storage, refreshToken) : null

    if (newToken) {
      headers.set('Authorization', `Bearer ${newToken}`)
      res = await fetch(`${API_BASE}${path}`, { ...options, headers })
    } else if (
      storage.getItem('token') === token &&
      storage.getItem('refreshToken') === refreshToken
    ) {
      clearTokens()
      window.location.href = '/login'
      throw new Error('Session expired. Please log in again.')
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { detail?: string }).detail ?? `HTTP ${res.status}`)
  }

  return res.json() as Promise<T>
}
