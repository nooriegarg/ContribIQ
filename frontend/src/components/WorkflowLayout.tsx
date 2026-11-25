import { useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useLocation, useMatch, useNavigate, useParams } from 'react-router-dom'
import { getAnalysisResult, type AnalysisResult } from '../api/analyze'
import { useAuth } from '../context/useAuth'
import { getRepoHistory, removeFromHistory, type RepoHistoryEntry } from '../hooks/useAnalysis'
import Avatar from './Avatar'
import WorkflowIcon from './WorkflowIcon'
import { getOpenIssues } from '../utils/issues'
import '../styles/mock-workflow.css'
import '../styles/workflow-shell.css'

export function getAvatarUrl(userId: string) {
  return localStorage.getItem(`avatar-${userId}`) ?? null
}

export interface WorkflowContext {
  taskId: string
  basePath: string
  result: AnalysisResult | null
}

const PROGRESS_KEY = (id: string) => `contribiq:progress:${id}`

function loadProgress(taskId: string): number {
  try {
    const val = parseInt(localStorage.getItem(PROGRESS_KEY(taskId)) ?? '1', 10)
    return isNaN(val) ? 1 : Math.max(1, val)
  }
  catch { return 1 /* parse error or storage unavailable */ }
}

function saveProgress(taskId: string, step: number) {
  try { localStorage.setItem(PROGRESS_KEY(taskId), String(step)) } catch { /* storage unavailable */ }
}

const steps = [
  { title: 'Repository Overview', subtitle: 'Understand the project', suffix: '' },
  { title: 'Onboarding Path', subtitle: 'Your first 30 minutes', suffix: '/onboarding' },
  { title: 'Your Profile', subtitle: 'Skills & interests', suffix: '/profile' },
  { title: 'Recommended Issues', subtitle: 'Find your first contribution', suffix: '/issues' },
  { title: 'Issue Deep-Dive', subtitle: 'Understand & contribute', suffix: '/issues' },
]

function isAnalysisReady(taskId: string) {
  return !!sessionStorage.getItem(`arch-${taskId}`)
}

export default function WorkflowLayout({ hero = false }: { hero?: boolean }) {
  const { taskId = '' } = useParams()
  const { token, user, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const detail = useMatch('/overview/:taskId/issues/:issueNumber')
  const [menuOpen, setMenuOpen] = useState(false)
  const cacheKey = `analysis:${taskId}`
  const [result, setResult] = useState<AnalysisResult | null>(() => {
    try { const c = sessionStorage.getItem(cacheKey); return c ? JSON.parse(c) : null } catch { return null }
  })
  const [loading, setLoading] = useState(!hero && !sessionStorage.getItem(cacheKey))
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [history, setHistory] = useState<RepoHistoryEntry[]>([])
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [switchBlocked, setSwitchBlocked] = useState(false)
  const [deleteConfirmTaskId, setDeleteConfirmTaskId] = useState<string | null>(null)
  const [analysisReady, setAnalysisReady] = useState(() => !hero && isAnalysisReady(taskId))
  const [avatarUrl, setAvatarUrl] = useState(() => user ? getAvatarUrl(user.id) : null)
  const basePath = `/overview/${encodeURIComponent(taskId)}`
  const currentStep = detail ? 5 : location.pathname.endsWith('/issues') ? 4
    : location.pathname.endsWith('/profile') ? 3 : location.pathname.endsWith('/onboarding') ? 2 : 1
  const [maxStep, setMaxStep] = useState<number>(() => loadProgress(taskId))
  const firstIssue = result ? getOpenIssues(result)[0] : undefined
  const issueNumber = detail?.params.issueNumber ?? firstIssue?.number

  useEffect(() => {
    if (hero) return
    if (currentStep > maxStep) {
      setMaxStep(currentStep)
      saveProgress(taskId, currentStep)
    }
  }, [currentStep, maxStep, taskId, hero, result, token])

  useEffect(() => {
    if (!user) return
    function onStorage(e: StorageEvent) {
      if (e.key === `avatar-${user!.id}`) setAvatarUrl(e.newValue)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [user])

  useEffect(() => {
    if (!hero) {
      setHistory(getRepoHistory())
      setAnalysisReady(isAnalysisReady(taskId))
    }
  }, [hero, taskId])

  // Poll until both sessionStorage keys are set so the switcher unlocks reactively
  useEffect(() => {
    if (hero || analysisReady) return
    const interval = setInterval(() => {
      if (isAnalysisReady(taskId)) {
        setAnalysisReady(true)
        clearInterval(interval)
      }
    }, 1500)
    return () => clearInterval(interval)
  }, [hero, taskId, analysisReady])

  function handleSwitchRepo(entry: RepoHistoryEntry) {
    setSwitcherOpen(false)
    setMenuOpen(false)
    navigate(`/overview/${encodeURIComponent(entry.taskId)}`)
  }

  function handleSwitchAttempt(entry: RepoHistoryEntry) {
    if (!analysisReady) {
      setSwitcherOpen(false)
      setSwitchBlocked(true)
      return
    }
    handleSwitchRepo(entry)
  }

  function handleNewRepoAttempt(e: React.MouseEvent) {
    if (!analysisReady) {
      e.preventDefault()
      setSwitcherOpen(false)
      setSwitchBlocked(true)
    }
  }

  function handleConfirmDelete(taskId: string) {
    const updated = removeFromHistory(taskId)
    setHistory(updated)
    setDeleteConfirmTaskId(null)
    if (taskId === decodeURIComponent(window.location.pathname.split('/')[2] ?? '')) {
      navigate('/dashboard')
    }
  }

  useEffect(() => {
    if (hero || !token) return
    let active = true
    setLoading(true)
    setError('')
    getAnalysisResult(taskId)
      .then(data => {
        if (!active) return
        setResult(data)
        sessionStorage.setItem(cacheKey, JSON.stringify(data))
      })
      .catch(reason => {
        if (active) setError(reason instanceof Error ? reason.message : 'Unable to load repository analysis.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [hero, taskId, token, attempt, cacheKey])

  if (!token) return <Navigate to="/login" replace />

  return (
    <div className={`contrib-shell${hero ? ' hero-layout' : ''}${menuOpen ? ' menu-open' : ''}`}>
      {hero ? (
        <header className="hero-nav">
          <Link className="sb-brand" to="/dashboard">
            <span className="sb-brand-icon"><WorkflowIcon name="cube" /></span>
            <span className="sb-brand-name">ContribIQ</span>
          </Link>
          <div className="hero-nav-user">
            <Link className="hero-avatar-link" to="/profile" title="Your profile">
              <Avatar name={user?.name ?? ''} avatarUrl={avatarUrl} size={34} />
            </Link>
            <Link className="btn btn-s" to="/profile">Profile</Link>
            <button className="btn hero-signout" onClick={logout}>Sign out</button>
          </div>
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
                const disabled = !result || (index + 1 > maxStep + 1) || (index === 4 && !issueNumber)
                const isDone = index + 1 <= maxStep && index + 1 !== currentStep
                const isActive = index + 1 === currentStep
                const content = <><span className="sb-dot">{isDone ? <WorkflowIcon name="check" /> : index + 1}</span><span><span className="sb-lbl">{step.title}</span><span className="sb-sub">{step.subtitle}</span></span></>
                const className = `sb-step${isActive ? ' active' : isDone ? ' done' : ''}`
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
              {history.length > 1 ? (
                <div className="sb-switcher">
                  <button
                    className={`sb-switcher-btn${!analysisReady ? ' locked' : ''}`}
                    onClick={() => analysisReady ? setSwitcherOpen(o => !o) : setSwitchBlocked(true)}
                    aria-expanded={switcherOpen}
                    aria-haspopup="listbox"
                    title={!analysisReady ? 'Wait for analysis to complete before switching' : undefined}
                  >
                    <span className="sb-switcher-label">
                      {!analysisReady && <span className="sb-switcher-lock" aria-hidden="true">⏳</span>}
                      Switch repository
                    </span>
                    <span className={`sb-switcher-arrow${switcherOpen ? ' open' : ''}`}><WorkflowIcon name="arrow" /></span>
                  </button>
                  {switcherOpen && analysisReady && (
                    <ul className="sb-switcher-menu" role="listbox" aria-label="Previously analyzed repositories">
                      {history.map(entry => (
                        <li key={entry.taskId} role="option" aria-selected={entry.taskId === taskId}>
                          <div className="sb-switcher-item-row">
                            <button
                              className={`sb-switcher-item${entry.taskId === taskId ? ' current' : ''}`}
                              onClick={() => handleSwitchAttempt(entry)}
                              disabled={entry.taskId === taskId}
                            >
                              {entry.fullName}
                              {entry.taskId === taskId && <span className="sb-switcher-badge">current</span>}
                            </button>
                            <button
                              className="sb-switcher-delete"
                              aria-label={`Delete ${entry.fullName}`}
                              title="Remove from history"
                              onClick={e => { e.stopPropagation(); setSwitcherOpen(false); setDeleteConfirmTaskId(entry.taskId) }}
                            >
                              ×
                            </button>
                          </div>
                        </li>
                      ))}
                      <li role="option" aria-selected={false}>
                        <Link className="sb-switcher-item sb-switcher-new" to="/dashboard"
                          onClick={(e) => { handleNewRepoAttempt(e); if (analysisReady) { setSwitcherOpen(false); setMenuOpen(false) } }}>
                          + Analyze new repository
                        </Link>
                      </li>
                    </ul>
                  )}
                </div>
              ) : (
                <Link className="sb-new-repo" to="/dashboard" onClick={handleNewRepoAttempt}>Analyze another repository</Link>
              )}
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
      {switchBlocked && (
        <div className="switch-block-overlay" role="dialog" aria-modal="true" aria-labelledby="switch-block-title" onClick={() => setSwitchBlocked(false)}>
          <div className="switch-block-modal" onClick={e => e.stopPropagation()}>
            <div className="switch-block-icon" aria-hidden="true">⏳</div>
            <h2 className="switch-block-title" id="switch-block-title">Analysis still in progress</h2>
            <p className="switch-block-desc">
              Please wait for the analysis to complete before switching repositories.
            </p>
            <button className="btn btn-p" onClick={() => setSwitchBlocked(false)} autoFocus>Got it</button>
          </div>
        </div>
      )}
      {deleteConfirmTaskId && (() => {
        const entry = history.find(e => e.taskId === deleteConfirmTaskId)
        return (
          <div className="switch-block-overlay" role="dialog" aria-modal="true" aria-labelledby="delete-confirm-title" onClick={() => setDeleteConfirmTaskId(null)}>
            <div className="switch-block-modal" onClick={e => e.stopPropagation()}>
              <div className="switch-block-icon" aria-hidden="true">🗑️</div>
              <h2 className="switch-block-title" id="delete-confirm-title">Remove from history?</h2>
              <p className="switch-block-desc">
                <strong>{entry?.fullName}</strong> will be removed from your repository history. The analysis data is not deleted.
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-p" style={{ background: '#e53e3e' }} onClick={() => handleConfirmDelete(deleteConfirmTaskId)} autoFocus>
                  Remove
                </button>
                <button className="btn btn-s" onClick={() => setDeleteConfirmTaskId(null)}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
