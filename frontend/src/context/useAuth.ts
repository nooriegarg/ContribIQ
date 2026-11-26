import { createContext, useContext } from 'react'

export interface User {
  id: string
  email: string
  name: string
  github_username: string | null
}

interface AuthContextValue {
  user: User | null
  token: string | null
  login: (token: string, refreshToken:string, user: User, rememberMe: boolean) => void
  logout: () => void
  updateUser: (partial: Partial<User>) => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}