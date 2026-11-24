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
      ctx.login('tok', 'ref', { id: '1', email: 'a@b.com', name: 'Alice' }, false)
    })

    expect(sessionStorage.getItem('token')).toBe('tok')
    expect(sessionStorage.getItem('refreshToken')).toBe('ref')
    expect(localStorage.getItem('token')).toBeNull()
  })

  it('login stores token in localStorage when rememberMe=true', () => {
    let ctx!: ReturnType<typeof useAuth>
    renderWithAuth((c) => { ctx = c })

    act(() => {
      ctx.login('tok', 'ref', { id: '1', email: 'a@b.com', name: 'Alice' }, true)
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

  it('restores token and user from localStorage on mount', () => {
    const user = { id: '1', email: 'a@b.com', name: 'Alice' }
    localStorage.setItem('token', 'stored-tok')
    localStorage.setItem('user', JSON.stringify(user))

    let ctx!: ReturnType<typeof useAuth>
    renderWithAuth((c) => { ctx = c })

    expect(ctx.token).toBe('stored-tok')
    expect(ctx.user).toEqual(user)
  })
})

describe('useAuth', () => {
  it('throws when used outside AuthProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<TestConsumer onMount={() => {}} />)).toThrow()
    spy.mockRestore()
  })
})
