import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiCall } from '../api/client'
import IssueCard, { type IssueMatch } from '../components/IssueCard'
import '../styles/workflow.css'

export default function IssuesPage() {
  const { jobId = '' } = useParams()
  const [issues, setIssues] = useState<IssueMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!jobId) return
    apiCall<IssueMatch[]>(`/analysis/${encodeURIComponent(jobId)}/matches`)
      .then(data => {
        // BUG: issues rendered in API response order, not sorted by match_pct.
        // "Best match" badge applied to issues[0] regardless of its score.
        // Fix: const sorted = [...data].sort((a, b) => b.match_pct - a.match_pct)
        setIssues(data)
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [jobId])

  return (
    <main className="workflow-page">
      <header className="workflow-header">
        <div>
          <Link className="workflow-brand" to="/dashboard">ContribIQ</Link>
          <h1>Recommended issues</h1>
          <p>Issues matched to your profile, ranked by fit.</p>
        </div>
        <span className="workflow-step">Step 4 of 5</span>
      </header>

      {loading && (
        <div style={{ color: 'var(--gm)', fontSize: 14, padding: '2rem 0' }}>
          Loading recommendations…
        </div>
      )}

      {error && (
        <div className="workflow-error" role="alert">{error}</div>
      )}

      {!loading && !error && issues.length === 0 && (
        <div style={{ color: 'var(--gm)', fontSize: 14, padding: '2rem 0' }}>
          No matches found for this repository.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
        {issues.map((issue, index) => (
          <IssueCard
            key={issue.issue_id}
            issue={issue}
            isBest={index === 0}
          />
        ))}
      </div>

      {!loading && issues.length > 0 && (
        <footer className="workflow-actions">
          <Link
            className="button-secondary"
            to={`/overview/${encodeURIComponent(jobId)}/profile`}
          >
            Back
          </Link>
        </footer>
      )}
    </main>
  )
}
