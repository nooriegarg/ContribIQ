import { createContext, useContext } from 'react'

export interface User {
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

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}