import React, { createContext, useContext, useState, useCallback } from 'react'

interface User {
  id: string
  email: string
  name: string
}

interface AuthContextValue {
  user: User | null
  token: string | null
  login: (token: string, user: User, rememberMe: boolean) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

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

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
