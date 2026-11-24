import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

export default function AuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login } = useAuth()

  useEffect(() => {
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
      .then((user) => {
        login(token, '', user, true)
        navigate('/dashboard', { replace: true })
      })
      .catch(() => {
        navigate('/login?error=auth_failed', { replace: true })
      })
  }, [login, navigate, searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950 text-white">
      <p className="text-lg text-gray-400">Signing you in…</p>
    </div>
  )
}
