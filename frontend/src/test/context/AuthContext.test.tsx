import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import { AuthProvider } from '../../context/AuthContext'
import { useAuth } from '../../context/useAuth'

function TestConsumer({ onMount }: { onMount: (ctx: ReturnType<typeof useAuth>) => void }) {
  const ctx = useAuth()
  onMount(ctx)
  return null
}

function renderWithAuth(onMount: (ctx: ReturnType<typeof useAuth>) => void) {
  render(
    <AuthProvider>
      <TestConsumer onMount={onMount} />
    </AuthProvider>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
  })

  it('starts with null user and token', () => {
    let ctx!: ReturnType<typeof useAuth>
    renderWithAuth((c) => { ctx = c })
    expect(ctx.user).toBeNull()
    expect(ctx.token).toBeNull()
  })

  it('login stores token and user in sessionStorage when rememberMe=false', () => {
    let ctx!: ReturnType<typeof useAuth>
    renderWithAuth((c) => { ctx = c })

    act(() => {
      ctx.login('tok', 'ref', { id: '1', email: 'a@b.com', name: 'Alice', github_username: null }, false)
    })

    expect(sessionStorage.getItem('token')).toBe('tok')
    expect(sessionStorage.getItem('refreshToken')).toBe('ref')
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('login stores token in localStorage when rememberMe=true', () => {
    let ctx!: ReturnType<typeof useAuth>
    renderWithAuth((c) => { ctx = c })

    act(() => {
      ctx.login('tok', 'ref', { id: '1', email: 'a@b.com', name: 'Alice', github_username: null }, true)
    })

    expect(localStorage.getItem('token')).toBe('tok')
    expect(sessionStorage.getItem('token')).toBeNull()
  })

  it('logout clears token and user', () => {
    localStorage.setItem('token', 'tok')
    localStorage.setItem('user', JSON.stringify({ id: '1', email: 'a@b.com', name: 'Alice' }))

    let ctx!: ReturnType<typeof useAuth>
    renderWithAuth((c) => { ctx = c })

    act(() => { ctx.logout() })

    expect(localStorage.getItem('token')).toBeNull()
    expect(ctx.token).toBeNull()
    expect(ctx.user).toBeNull()
  })

  it('logout redirects to /login via window.location.href', () => {
    let ctx!: ReturnType<typeof useAuth>
    renderWithAuth((c) => { ctx = c })

    const originalHref = window.location.href
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: originalHref },
    })

    act(() => { ctx.logout() })

    expect(window.location.href).toBe('/login')
  })

  it('restores token and user from localStorage on mount', () => {
    const user = { id: '1', email: 'a@b.com', name: 'Alice' }
    localStorage.setItem('token', 'stored-tok')
    localStorage.setItem('user', JSON.stringify(user))

    let ctx!: ReturnType<typeof useAuth>
    renderWithAuth((c) => { ctx = c })

    expect(ctx.token).toBe('stored-tok')
    expect(ctx.user).toEqual(user)
  })

  it('updateUser merges partial into user state', () => {
    localStorage.setItem('token', 'tok')
    localStorage.setItem('user', JSON.stringify({ id: '1', email: 'a@b.com', name: 'Alice' }))

    let ctx!: ReturnType<typeof useAuth>
    renderWithAuth((c) => { ctx = c })

    act(() => {
      ctx.updateUser({ name: 'Alice Updated' })
    })

    expect(ctx.user?.name).toBe('Alice Updated')
    expect(ctx.user?.email).toBe('a@b.com')
  })

  it('updateUser persists updated user to localStorage', () => {
    localStorage.setItem('token', 'tok')
    localStorage.setItem('user', JSON.stringify({ id: '1', email: 'a@b.com', name: 'Alice' }))

    let ctx!: ReturnType<typeof useAuth>
    renderWithAuth((c) => { ctx = c })

    act(() => {
      ctx.updateUser({ name: 'Bob', email: 'bob@example.com' })
    })

    const stored = JSON.parse(localStorage.getItem('user') ?? '{}')
    expect(stored.name).toBe('Bob')
    expect(stored.email).toBe('bob@example.com')
  })

  it('updateUser persists to sessionStorage when user was stored there', () => {
    sessionStorage.setItem('token', 'tok')
    sessionStorage.setItem('user', JSON.stringify({ id: '1', email: 'a@b.com', name: 'Alice' }))

    let ctx!: ReturnType<typeof useAuth>
    renderWithAuth((c) => { ctx = c })

    act(() => {
      ctx.updateUser({ name: 'Session Bob' })
    })

    const stored = JSON.parse(sessionStorage.getItem('user') ?? '{}')
    expect(stored.name).toBe('Session Bob')
  })

  it('syncAccessToken updates token when auth:token-refreshed fires', () => {
    localStorage.setItem('token', 'old-tok')

    let ctx!: ReturnType<typeof useAuth>
    renderWithAuth((c) => { ctx = c })

    act(() => {
      localStorage.setItem('token', 'new-tok')
      window.dispatchEvent(new Event('auth:token-refreshed'))
    })

    expect(ctx.token).toBe('new-tok')
  })
})

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestConsumer onMount={() => {}} />)).toThrow()
    spy.mockRestore()
  })
})
