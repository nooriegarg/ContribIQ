import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { refreshMe } from '../api/auth'
import { useAuth } from '../context/useAuth'

export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login, updateUser } = useAuth()

  useEffect(() => {
    // Link-mode: GitHub account was linked to an existing email account
    if (searchParams.get('linked') === 'true') {
      const githubToken = searchParams.get('github_token')
      if (githubToken) {
        localStorage.setItem('github_token', githubToken)
      }
      const redirectPath = searchParams.get('redirect')
      refreshMe()
        .then((user) => {
          updateUser(user)
          const dest = redirectPath
            ? `${redirectPath}?linked=true`
            : '/profile?linked=true'
          navigate(dest, { replace: true })
        })
        .catch(() => {
          navigate('/profile', { replace: true })
        })
      return
    }

    const token = searchParams.get('access_token')
    if (!token) {
      navigate('/login?error=auth_failed', { replace: true })
      return
    }

    const githubToken = searchParams.get('github_token')
    if (githubToken) {
      localStorage.setItem('github_token', githubToken)
    }

    const base = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
    fetch(`${base}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch user')
        return res.json()
      })
      .then((me) => {
        const user = {
          id: me.id,
          email: me.email,
          name: me.name ?? me.email.split('@')[0],
          github_username: me.github_username ?? null,
        }
        const refreshToken = searchParams.get('refresh_token') ?? ''
        login(token, refreshToken, user, true)
        navigate('/dashboard', { replace: true })
      })
      .catch(() => {
        navigate('/login?error=auth_failed', { replace: true })
      })
  }, [login, navigate, searchParams, updateUser])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
      <p className="text-lg text-gray-400">Signing you in…</p>
    </div>
  )
}
