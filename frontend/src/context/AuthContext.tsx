import React, { useState, useCallback,useEffect } from 'react'
import { AuthContext, type User } from './useAuth'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('token') ?? sessionStorage.getItem('token')
  )
  useEffect(() => {
  function syncAccessToken() {
    setToken(localStorage.getItem('token') ?? sessionStorage.getItem('token'))
  }

  window.addEventListener('auth:token-refreshed', syncAccessToken)
  return () => window.removeEventListener('auth:token-refreshed', syncAccessToken)
  }, [])
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem('user') ?? sessionStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  })

  const login = useCallback((newToken: string, newRefreshToken:string, newUser: User, rememberMe: boolean) => {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('refreshToken')
    sessionStorage.removeItem('user')
    const storage = rememberMe ? localStorage : sessionStorage
    storage.setItem('token', newToken)
    storage.setItem('refreshToken', newRefreshToken)
    storage.setItem('user', JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
    localStorage.removeItem('github_token')
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('refreshToken')
    sessionStorage.removeItem('user')
    const keysToRemove = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key && (key.startsWith('analysis:') || key.startsWith('onboarding-plan-') || key.startsWith('profile:'))) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => sessionStorage.removeItem(key))
    setToken(null)
    setUser(null)
    window.location.href = '/login'
  }, [])

  const updateUser = useCallback((partial: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev
      const next = { ...prev, ...partial }
      if (localStorage.getItem('user')) {
        localStorage.setItem('user', JSON.stringify(next))
      } else {
        sessionStorage.setItem('user', JSON.stringify(next))
      }
      return next
    })
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

