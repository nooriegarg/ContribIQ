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
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('refreshToken')
    sessionStorage.removeItem('user')
    setToken(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

