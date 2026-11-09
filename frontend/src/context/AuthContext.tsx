import React, { useState, useCallback } from 'react'
import { AuthContext, type User } from './useAuth'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('token') ?? sessionStorage.getItem('token')
  )
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem('user') ?? sessionStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  })

  const login = useCallback((newToken: string, newUser: User, rememberMe: boolean) => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')
    const storage = rememberMe ? localStorage : sessionStorage
    storage.setItem('token', newToken)
    storage.setItem('user', JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    sessionStorage.removeItem('token')
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

