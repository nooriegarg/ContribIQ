import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useWorkflow } from '../hooks/useWorkflow'
import { getIssueLoadError, getOpenIssues } from '../utils/issues'
import WorkflowHeader from '../components/WorkflowHeader'
import WorkflowIcon from '../components/WorkflowIcon'

export default function IssuesPage() {
  const { basePath, result } = useWorkflow()
  const [query, setQuery] = useState('')
  const [label, setLabel] = useState('')
  if (!result) return null
  const issues = getOpenIssues(result)
  const issueError = getIssueLoadError(result)
  const labels = [...new Set(issues.flatMap(issue => issue.labels.map(item => item.name)))].sort((a, b) => a.localeCompare(b))
  const search = query.trim().toLowerCase()
  const filtered = issues.filter(issue =>
    (!label || issue.labels.some(item => item.name === label))
    && (!search || `${issue.number} ${issue.title} ${issue.body ?? ''}`.toLowerCase().includes(search.replace(/^#(?=\d)/, ''))),
  )

  return (
    <section className="screen active">
      <WorkflowHeader title="Recommended Issues" subtitle={`Explore open issues in ${result.metadata.full_name}`} step={4} />
      <div className="issues-hero">
        <h2 className="ih-title">Find your first contribution</h2>
        <p className="ih-sub">{issues.length} open {issues.length === 1 ? 'issue' : 'issues'} in this analysis</p>
        <div className="profile-chips">{result.tech_stack.map(tech => <span className="p-chip" key={tech}>{tech}</span>)}<span className="p-chip">GitHub issue data</span></div>
      </div>
      <div className="page-body">
        <p className="notice">These are real repository issues, not personalized recommendations yet. AI match scores, difficulty scores, and match reasons are not connected to this screen.</p>
        {issueError ? <div className="notice error" role="alert">{issueError}<p className="mt8"><Link className="btn btn-s" to="/dashboard">Run a new analysis</Link></p></div> : (
          <>
            <div className="issue-filters">
              <label>Search issues<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Title, description, or issue number" /></label>
              <label>Label<select value={label} onChange={event => setLabel(event.target.value)}><option value="">All labels</option>{labels.map(name => <option value={name} key={name}>{name}</option>)}</select></label>
            </div>
            <p className="muted filter-count" role="status">{filtered.length} {filtered.length === 1 ? 'issue' : 'issues'} shown</p>
            {filtered.map(issue => (
              <Link className="issue-card" to={`${basePath}/issues/${issue.number}`} key={issue.number}>
                <div className="match-ring" aria-label="AI match score unavailable">
                  <svg viewBox="0 0 62 62" aria-hidden="true"><circle cx="31" cy="31" r="26" fill="none" stroke="#EAECEE" strokeWidth="5" /></svg>
                  <span className="match-text"><span className="match-pct">--</span><span className="match-lbl">Unscored</span></span>
                </div>
                <div className="issue-body">
                  <div className="issue-top"><span className="issue-num">#{issue.number}</span><h2 className="issue-ttl">{issue.title}</h2><span className="badge badge-gray">Not ranked</span></div>
                  <p className="issue-desc">{issue.body ? `${issue.body.slice(0, 220)}${issue.body.length > 220 ? '...' : ''}` : 'No description provided. Open the issue to explore contribution guidance.'}</p>
                  <div className="issue-tags">{issue.labels.map(item => <span className={`badge ${item.name.toLowerCase() === 'good first issue' ? 'badge-green' : 'badge-blue'}`} key={item.name}>{item.name}</span>)}</div>
                  <div className="issue-reasons"><p className="muted">View issue details and your contribution checklist<WorkflowIcon name="arrow" /></p></div>
                </div>
                <span className="issue-arr"><WorkflowIcon name="arrow" /></span>
              </Link>
            ))}
            {filtered.length === 0 && <div className="card"><h2 className="ctitle">{issues.length === 0 ? 'No open issues in this analysis' : 'No issues match your filters'}</h2><p className="muted">{issues.length === 0 ? 'Try another repository, or check GitHub for newer issues.' : 'Try a different search or select All labels.'}</p>{(query || label) && <button className="btn btn-s mt12" onClick={() => { setQuery(''); setLabel('') }}>Clear filters</button>}</div>}
          </>
        )}
      </div>
      <footer className="action-row"><p className="ar-hint">Select an issue to explore its details and plan your contribution.</p><Link className="btn btn-s" to={`${basePath}/profile`}>Back to Profile</Link></footer>
    </section>
  )
}
