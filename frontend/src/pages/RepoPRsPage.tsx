import { useEffect, useState } from 'react'
import { useLocation, useOutletContext, useSearchParams } from 'react-router-dom'
import { getGitHubLinkUrl } from '../api/auth'
import { getMyPRs, type UserPR } from '../api/profile'
import { useAuth } from '../context/useAuth'
import type { WorkflowContext } from '../components/WorkflowLayout'
import WorkflowHeader from '../components/WorkflowHeader'
import '../styles/user-profile.css'

type PRState = 'open' | 'closed' | 'merged' | 'all'

const STATE_LABELS: Record<PRState, string> = {
  open: 'Open',
  closed: 'Closed',
  merged: 'Merged',
  all: 'All',
}

function CIBadge({ status }: { status: UserPR['ci_status'] }) {
  const map = {
    success: { label: 'Checks passed', cls: 'ci-success' },
    failure: { label: 'Checks failed', cls: 'ci-failure' },
    running: { label: 'Checks running', cls: 'ci-running' },
    pending: { label: 'No checks', cls: 'ci-pending' },
  }
  const { label, cls } = map[status] ?? map.pending
  return <span className={`up-ci-badge ${cls}`}>{label}</span>
}

function StateBadge({ state, mergedAt }: { state: string; mergedAt: string | null }) {
  if (mergedAt) return <span className="up-ci-badge" style={{ background: '#8b5cf6', color: 'white' }}>Merged</span>
  if (state === 'open') return <span className="up-ci-badge ci-success">Open</span>
  return <span className="up-ci-badge ci-failure" style={{ textTransform: 'capitalize' }}>{state}</span>
}

function CheckIcon({ conclusion, status }: { conclusion: string | null; status: string }) {
  if (conclusion === 'success') return <span className="up-check-dot ci-success">✓</span>
  if (conclusion === 'failure' || conclusion === 'timed_out') return <span className="up-check-dot ci-failure">✗</span>
  if (status === 'in_progress' || status === 'queued') return <span className="up-check-dot ci-running">◷</span>
  return <span className="up-check-dot ci-pending">–</span>
}

export default function RepoPRsPage() {
  const { result } = useOutletContext<WorkflowContext>()
  const { user } = useAuth()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const PAGE_SIZE = 15

  const [prState, setPrState] = useState<PRState>('open')
  const [prs, setPRs] = useState<UserPR[] | null>(null)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [linkedBanner, setLinkedBanner] = useState(() => searchParams.get('linked') === 'true')

  useEffect(() => {
    if (linkedBanner) setSearchParams({}, { replace: true })
  }, [linkedBanner, setSearchParams])

  const owner = result?.owner ?? ''
  const repo = result?.repo ?? ''
  const repoFull = owner && repo ? `${owner}/${repo}` : null

  useEffect(() => {
    if (!user?.github_username || !repoFull) return
    let active = true
    setPRs(null)
    setPage(1)
    setLoading(true)
    setError('')
    const githubToken = localStorage.getItem('github_token')
    const apiState = prState === 'merged' ? 'closed' : prState
    getMyPRs(githubToken, apiState)
      .then(data => {
        if (!active) return
        let filtered = data.filter(pr => pr.repo === repoFull)
        if (prState === 'merged') filtered = filtered.filter(pr => pr.merged_at !== null)
        if (prState === 'closed') filtered = filtered.filter(pr => pr.merged_at === null)
        setPRs(filtered)
      })
      .catch(reason => {
        if (active) setError(reason instanceof Error ? reason.message : 'Could not load pull requests.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [user?.github_username, repoFull, prState])

  if (!user?.github_username) {
    return (
      <div className="up-gh-connect">
        <svg className="up-gh-icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
        </svg>
        <h2 className="up-gh-title">Connect your GitHub account</h2>
        <p className="up-gh-desc">Link your GitHub account to track pull requests you've raised and see their CI status at a glance.</p>
        <a className="btn btn-p up-gh-btn" href={getGitHubLinkUrl(location.pathname)}>Connect GitHub</a>
      </div>
    )
  }

  const emptyMsg = prState === 'open'
    ? 'No open pull requests in this repository.'
    : prState === 'closed'
    ? 'No closed pull requests in this repository.'
    : prState === 'merged'
    ? 'No merged pull requests in this repository.'
    : 'No pull requests found in this repository.'

  const totalPages = prs ? Math.ceil(prs.length / PAGE_SIZE) : 0
  const pagePRs = prs ? prs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) : []

  return (
    <div>
      <WorkflowHeader title="Pull Requests" subtitle="Track your contributions" step={6} />
      <div style={{ padding: '32px 40px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--b10)', margin: 0, marginBottom: 4 }}>
            Pull Requests
          </h1>
          {repoFull && (
            <p style={{ fontSize: 13, color: 'var(--gd)', margin: 0 }}>
              Your contributions to <strong>{repoFull}</strong>
              {prs && prs.length > 0 && <span style={{ marginLeft: 8, color: 'var(--gd)' }}>({prs.length} total)</span>}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label htmlFor="pr-state-filter" style={{ fontSize: 13, fontWeight: 600, color: 'var(--b10)', whiteSpace: 'nowrap' }}>
            Show:
          </label>
          <select
            id="pr-state-filter"
            value={prState}
            onChange={e => setPrState(e.target.value as PRState)}
            style={{
              padding: '6px 10px',
              border: '1px solid #ccd4df',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--b10)',
              background: 'white',
              cursor: 'pointer',
              appearance: 'auto',
            }}
          >
            {(Object.keys(STATE_LABELS) as PRState[]).map(s => (
              <option key={s} value={s}>{STATE_LABELS[s]}</option>
            ))}
          </select>
        </div>
      </div>

      {linkedBanner && (
        <div className="notice success" role="status" style={{ marginBottom: 20 }}>
          GitHub account connected successfully! Your pull requests are loading below.
          <button
            type="button"
            onClick={() => setLinkedBanner(false)}
            style={{ marginLeft: 12, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: 'inherit' }}
            aria-label="Dismiss"
          >✕</button>
        </div>
      )}

      {loading && <p className="up-loading" role="status">Loading pull requests…</p>}
      {error && <div className="notice error" role="alert">{error}</div>}

      {!loading && !error && prs !== null && prs.length === 0 && (
        <div className="up-prs-empty">
          <p className="muted">{emptyMsg}</p>
        </div>
      )}

      {pagePRs.length > 0 && (
        <div className="up-prs">
          {pagePRs.map(pr => (
            <div className="up-pr-card" key={`${pr.state}-${pr.number}`}>
              <div className="up-pr-header">
                <div className="up-pr-meta">
                  <span className="up-pr-num">#{pr.number}</span>
                  <StateBadge state={pr.state} mergedAt={pr.merged_at} />
                  {pr.draft && <span className="badge badge-blue">Draft</span>}
                </div>
                <CIBadge status={pr.ci_status} />
              </div>
              <a className="up-pr-title" href={pr.url ?? '#'} target="_blank" rel="noreferrer">{pr.title}</a>
              {pr.checks.length > 0 && (
                <div className="up-pr-checks">
                  {pr.checks.map((check, i) => (
                    <a
                      key={i}
                      className={`up-check-item up-check-${check.conclusion ?? check.status}`}
                      href={check.url ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                      title={check.name}
                    >
                      <CheckIcon conclusion={check.conclusion} status={check.status} />
                      <span className="up-check-name">{check.name}</span>
                    </a>
                  ))}
                </div>
              )}
              {pr.updated_at && (
                <p className="up-pr-updated">Updated {new Date(pr.updated_at).toLocaleDateString()}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24 }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: '1px solid #ccd4df',
              background: page === 1 ? '#f5f7fa' : 'white',
              color: page === 1 ? '#aab4c0' : 'var(--b10)',
              fontWeight: 600,
              fontSize: 13,
              cursor: page === 1 ? 'default' : 'pointer',
            }}
          >← Prev</button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button
              key={p}
              onClick={() => setPage(p)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid',
                borderColor: p === page ? 'var(--accent, #6366f1)' : '#ccd4df',
                background: p === page ? 'var(--accent, #6366f1)' : 'white',
                color: p === page ? 'white' : 'var(--b10)',
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                minWidth: 36,
              }}
            >{p}</button>
          ))}

          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              border: '1px solid #ccd4df',
              background: page === totalPages ? '#f5f7fa' : 'white',
              color: page === totalPages ? '#aab4c0' : 'var(--b10)',
              fontWeight: 600,
              fontSize: 13,
              cursor: page === totalPages ? 'default' : 'pointer',
            }}
          >Next →</button>
        </div>
      )}
    </div>
    </div>
  )
}
