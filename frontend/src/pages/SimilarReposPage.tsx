import { useEffect, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'
import { getSimilarRepos, type SimilarRepo } from '../api/analyze'
import type { WorkflowContext } from '../components/WorkflowLayout'
import WorkflowHeader from '../components/WorkflowHeader'
import '../styles/user-profile.css'

export default function SimilarReposPage() {
  const { taskId = '' } = useParams()
  useOutletContext<WorkflowContext>()

  const [similarRepos, setSimilarRepos] = useState<SimilarRepo[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!taskId) return
    let active = true
    setLoading(true)
    setSimilarRepos(null)
    getSimilarRepos(taskId)
      .then(r => { if (active) setSimilarRepos(r) })
      .catch(() => { if (active) setSimilarRepos([]) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [taskId])

  return (
    <div>
      <WorkflowHeader title="Similar Repositories" subtitle="Explore related projects" step={7} />
      <div style={{ padding: '32px 40px' }}>
        <p style={{ fontSize: 13, color: 'var(--gd)', margin: '0 0 24px' }}>
          Repositories with a similar tech stack and beginner-friendly issues. Explore them or run a ContribIQ analysis.
        </p>

        {loading && <p className="up-loading" role="status">Finding similar repositories…</p>}

        {!loading && similarRepos !== null && similarRepos.length === 0 && (
          <p className="muted">No similar repositories found.</p>
        )}

        {!loading && similarRepos && similarRepos.length > 0 && (
          <div className="similar-repos-list">
            {similarRepos.map(repo => (
              <div className="similar-repo-card" key={repo.full_name}>
                <div className="similar-repo-top">
                  <span className="similar-repo-name">{repo.full_name}</span>
                  <div className="similar-repo-meta">
                    {repo.language && <span className="badge badge-blue">{repo.language}</span>}
                    <span className="similar-repo-stat">★ {repo.stars.toLocaleString()}</span>
                    <span className="similar-repo-stat">{repo.open_issues} open issues</span>
                  </div>
                </div>
                {repo.description && <p className="similar-repo-desc">{repo.description}</p>}
                {repo.topics.length > 0 && (
                  <div className="issue-tags">
                    {repo.topics.slice(0, 5).map(t => <span className="badge badge-gray" key={t}>{t}</span>)}
                  </div>
                )}
                <div className="similar-repo-actions">
                  <Link className="btn btn-p" to={`/dashboard?repo=https://github.com/${repo.full_name}`}>
                    Analyze with ContribIQ
                  </Link>
                  <a className="btn btn-s" href={repo.html_url} target="_blank" rel="noreferrer">
                    View on GitHub ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
