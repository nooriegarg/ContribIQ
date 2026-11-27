import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAnalysis, getRepoHistory, type RepoHistoryEntry } from '../hooks/useAnalysis'
import { parseGitHubRepository } from '../utils/validation'
import WorkflowIcon from '../components/WorkflowIcon'
import { useAuth } from '../context/useAuth'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const analysis = useAnalysis()
  const { user } = useAuth()
  const [repository, setRepository] = useState(() => searchParams.get('repo') ?? '')
  const [inputError, setInputError] = useState('')
  const [existingEntry, setExistingEntry] = useState<RepoHistoryEntry | null>(null)
  const busy = ['starting', 'running', 'done'].includes(analysis.status)

  useEffect(() => {
    if (analysis.status === 'done' && analysis.taskId) {
      navigate(`/overview/${encodeURIComponent(analysis.taskId)}`)
    }
  }, [analysis.status, analysis.taskId, navigate])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    const parsed = parseGitHubRepository(repository)
    if (!parsed) {
      setInputError('Enter a GitHub repository URL or owner/repository, for example psf/requests.')
      return
    }
    setInputError('')
    const fullName = `${parsed.owner}/${parsed.repo}`
    const history = getRepoHistory(user?.id)
    const found = history.find(e => e.fullName.toLowerCase() === fullName.toLowerCase())
    if (found) {
      setExistingEntry(found)
      return
    }
    await analysis.run(parsed.owner, parsed.repo)
  }

  async function handleAnalyzeAnyway() {
    setExistingEntry(null)
    const parsed = parseGitHubRepository(repository)
    if (parsed) await analysis.run(parsed.owner, parsed.repo)
  }

  return (
    <section className="screen active" id="screen-hero">
      <div className="hero-bg" aria-hidden="true" />
      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-content">
        <div className="hero-badge"><span className="hero-badge-dot" />AI-Powered &middot; GitHub Integration &middot; Personalized</div>
        <h1 className="hero-title">Your path to your<br /><em>first contribution</em></h1>
        <p className="hero-desc">Paste any open-source GitHub URL. ContribIQ analyzes the repository, builds you a personalized onboarding guide, and helps you find an issue to start with.</p>
        <form onSubmit={handleSubmit} noValidate aria-busy={busy}>
          <div className="hero-input-group">
            <span className="hero-prefix" aria-hidden="true"><WorkflowIcon name="code" /></span>
            <input id="repo-url" type="text" aria-label="GitHub repository" aria-invalid={!!inputError}
              aria-describedby={inputError ? 'repo-input-error' : undefined}
              placeholder="github.com/owner/repository" value={repository} disabled={busy}
              autoCapitalize="none" spellCheck={false}
              onChange={event => { setRepository(event.target.value); setInputError('') }} />
            <button id="analyze-btn" type="submit" disabled={busy}>
              <WorkflowIcon name="arrow" />{analysis.status === 'error' ? 'Try Again' : 'Analyze Repository'}
            </button>
          </div>
          {inputError && <p className="hero-error" id="repo-input-error" role="alert">{inputError}</p>}
          {analysis.error && <p className="hero-error" role="alert">{analysis.error}</p>}
        </form>
        <div className="hero-feats">
          <span className="hero-feat"><span className="hf-dot"><WorkflowIcon name="check" /></span>Issue Discovery</span>
          <span className="hero-feat"><span className="hf-dot"><WorkflowIcon name="stack" /></span>Codebase Walkthrough</span>
          <span className="hero-feat"><span className="hf-dot"><WorkflowIcon name="clock" /></span>Guided Onboarding</span>
          <span className="hero-feat"><span className="hf-dot"><WorkflowIcon name="check" /></span>Contribution Checklist</span>
        </div>
      </div>
      {busy && (
        <div id="load-overlay" className="show" role="status" aria-live="polite">
          <div className="ld-box">
            <div className="ld-spin-wrap"><div className="ld-spin" /></div>
            <h2 className="ld-title">{analysis.status === 'starting' ? 'Submitting analysis...' : 'Analyzing your repository'}</h2>
            <p className="ld-url">{repository}</p>
            <div className="ld-steps">
              <div className="ld-step active"><span className="ld-icon">1</span>{analysis.taskId ? 'Waiting for analysis results...' : 'Connecting to the analysis queue...'}</div>
              {analysis.steps.map((step, index) => (
                <div className={`ld-step ${step.status === 'done' ? 'done' : 'active'}`} key={`${step.step}-${index}`}>
                  <span className="ld-icon">{index + 2}</span>{step.step.replace(/_/g, ' ')}: {step.status}
                </div>
              ))}
            </div>
            <p className="ld-hint">This can take up to two minutes. Keep the background worker running.</p>
            <button className="btn btn-s mt16" onClick={analysis.reset} type="button">Stop waiting</button>
          </div>
        </div>
      )}
      {existingEntry && (
        <div className="switch-block-overlay" role="dialog" aria-modal="true" aria-labelledby="existing-repo-title" onClick={() => setExistingEntry(null)}>
          <div className="switch-block-modal" onClick={e => e.stopPropagation()}>
            <div className="switch-block-icon" aria-hidden="true">📂</div>
            <h2 className="switch-block-title" id="existing-repo-title">Analysis already exists</h2>
            <p className="switch-block-desc">
              <strong>{existingEntry.fullName}</strong> was analyzed on {new Date(existingEntry.analyzedAt).toLocaleDateString()}. Would you like to view that analysis or run a fresh one?
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-p" onClick={() => navigate(`/overview/${encodeURIComponent(existingEntry.taskId)}`)} autoFocus>
                Switch to repo
              </button>
              <button className="btn btn-s" onClick={handleAnalyzeAnyway}>
                Analyze again
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
