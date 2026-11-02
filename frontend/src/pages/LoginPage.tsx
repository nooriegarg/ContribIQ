import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageBackground from '../components/PageBackground'
import BrandLogo from '../components/BrandLogo'
import LoginForm from '../components/LoginForm'
import SignupForm from '../components/SignupForm'
import SuccessState from '../components/SuccessState'
import TrustBar from '../components/TrustBar'
import '../styles/background.css'
import '../styles/login.css'

type View = 'login' | 'signup'

export default function LoginPage() {
  const [view, setView]         = useState<View>('login')
  const [succeeded, setSucceeded] = useState(false)
  const navigate = useNavigate()

  function handleRedirect() {
    navigate('/dashboard')
  }

  return (
    <>
      <PageBackground />
      <div className="login-page">
        <BrandLogo />
        <div className="card">
          {succeeded ? (
            <SuccessState onRedirectDone={handleRedirect} />
          ) : view === 'login' ? (
            <LoginForm onSuccess={() => setSucceeded(true)} />
          ) : (
            <SignupForm />
          )}

          {!succeeded && (
            <div className="card-footer">
              {view === 'login' ? (
                <>
                  Don&apos;t have an account?{' '}
                  <a href="#" onClick={e => { e.preventDefault(); setView('signup') }}>
                    Create one free
                  </a>
                </>
              ) : (
                <>
                  Already have an account?{' '}
                  <a href="#" onClick={e => { e.preventDefault(); setView('login') }}>
                    Sign in
                  </a>
                </>
              )}
            </div>
          )}
        </div>
        <TrustBar />
      </div>
    </>
  )
}
