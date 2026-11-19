import { useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useLocation, useMatch, useParams } from 'react-router-dom'
import { getAnalysisResult, type AnalysisResult } from '../api/analyze'
import { useAuth } from '../context/useAuth'
import WorkflowIcon from './WorkflowIcon'
import { getOpenIssues } from '../utils/issues'
import '../styles/mock-workflow.css'
import '../styles/workflow-shell.css'

export interface WorkflowContext {
  taskId: string
  basePath: string
  result: AnalysisResult | null
}

const steps = [
  { title: 'Repository Overview', subtitle: 'Understand the project', suffix: '' },
  { title: 'Onboarding Path', subtitle: 'Your first 30 minutes', suffix: '/onboarding' },
  { title: 'Your Profile', subtitle: 'Skills & interests', suffix: '/profile' },
  { title: 'Recommended Issues', subtitle: 'Find your first contribution', suffix: '/issues' },
  { title: 'Issue Deep-Dive', subtitle: 'Understand & contribute', suffix: '/issues' },
]

export default function WorkflowLayout({ hero = false }: { hero?: boolean }) {
  const { taskId = '' } = useParams()
  const { token, user, logout } = useAuth()
  const location = useLocation()
  const detail = useMatch('/overview/:taskId/issues/:issueNumber')
  const [menuOpen, setMenuOpen] = useState(false)
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(!hero)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const basePath = `/overview/${encodeURIComponent(taskId)}`
  const currentStep = detail ? 5 : location.pathname.endsWith('/issues') ? 4
    : location.pathname.endsWith('/profile') ? 3 : location.pathname.endsWith('/onboarding') ? 2 : 1
  const firstIssue = result ? getOpenIssues(result)[0] : undefined
  const issueNumber = detail?.params.issueNumber ?? firstIssue?.number

  useEffect(() => {
    if (hero || !token) return
    let active = true
    setLoading(true)
    setError('')
    setResult(null)
    getAnalysisResult(taskId)
      .then(data => { if (active) setResult(data) })
      .catch(reason => {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load repository analysis.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [hero, taskId, token, attempt])

  if (!token) return <Navigate to="/login" replace />

  return (
    <div className={`contrib-shell${hero ? ' hero-layout' : ''}${menuOpen ? ' menu-open' : ''}`}>
      {hero ? (
        <header className="hero-nav">
          <Link className="sb-brand" to="/dashboard">
            <span className="sb-brand-icon"><WorkflowIcon name="cube" /></span>
            <span className="sb-brand-name">ContribIQ</span>
          </Link>
          <div className="hero-nav-user"><span>{user?.name}</span><button className="btn hero-signout" onClick={logout}>Sign out</button></div>
        </header>
      ) : (
        <>
          <header className="mobile-nav">
            <button className="btn btn-s" aria-expanded={menuOpen} aria-controls="sidebar" onClick={() => setMenuOpen(!menuOpen)}>Menu</button>
            <Link to="/dashboard">ContribIQ</Link>
          </header>
          {menuOpen && <button className="nav-backdrop" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
          <aside id="sidebar" aria-label="Contribution workflow">
            <div className="sb-header">
              <Link className="sb-brand" to="/dashboard">
                <span className="sb-brand-icon"><WorkflowIcon name="cube" /></span>
                <span><span className="sb-brand-name">ContribIQ</span><span className="sb-brand-tag">Open-Source Onboarding</span></span>
              </Link>
            </div>
            <div className="sb-repo-pill show">
              <div className="sb-repo-label">Repository</div>
              <div className="sb-repo-name">{result ? result.metadata.full_name || `${result.owner}/${result.repo}` : 'Loading repository...'}</div>
            </div>
            <nav className="sb-steps" aria-label="Workflow steps">
              {steps.map((step, index) => {
                const disabled = !result || (index === 4 && !issueNumber)
                const content = <><span className="sb-dot">{index + 1 < currentStep ? <WorkflowIcon name="check" /> : index + 1}</span><span><span className="sb-lbl">{step.title}</span><span className="sb-sub">{step.subtitle}</span></span></>
                const className = `sb-step${currentStep === index + 1 ? ' active' : index + 1 < currentStep ? ' done' : ''}`
                return disabled ? (
                  <span className={`${className} locked`} aria-disabled="true" key={step.title}>{content}</span>
                ) : (
                  <Link className={className} key={step.title} aria-current={currentStep === index + 1 ? 'page' : undefined}
                    to={index === 4 ? `${basePath}/issues/${issueNumber}` : `${basePath}${step.suffix}`}
                    onClick={() => setMenuOpen(false)}>{content}</Link>
                )
              })}
            </nav>
            <footer className="sb-footer">
              <Link className="sb-new-repo" to="/dashboard">Analyze another repository</Link>
              <p>AI-powered open-source contributor onboarding.</p>
              <button className="sb-signout" onClick={logout}>Sign out</button>
            </footer>
          </aside>
        </>
      )}
      <main id="main" className={hero ? 'full' : undefined}>
        {loading ? <div className="workflow-state" role="status"><div className="ld-spin" /><h1>Loading repository analysis...</h1></div>
          : error ? <div className="workflow-state" role="alert"><h1>Unable to load analysis</h1><p>{error}</p><button className="btn btn-p" onClick={() => setAttempt(attempt + 1)}>Try again</button><Link className="btn btn-s" to="/dashboard">Back to dashboard</Link></div>
            : <Outlet context={{ taskId, basePath, result } satisfies WorkflowContext} />}
      </main>
    </div>
  )
}
