import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMatchedIssues, getGeneratedIssues, type IssueMatch, type GeneratedIssue } from '../api/analyze'
import { useWorkflow } from '../hooks/useWorkflow'
import { useAuth } from '../context/useAuth'
import { getIssueLoadError, getOpenIssues } from '../utils/issues'
import WorkflowHeader from '../components/WorkflowHeader'
import WorkflowIcon from '../components/WorkflowIcon'

function buildGitHubIssueUrl(owner: string, repo: string, issue: GeneratedIssue): string {
  const kindLabel = issue.gap_kind === 'todo' ? 'TODO/FIXME' : issue.gap_kind === 'untested' ? 'Missing Tests' : 'Missing Docs'
  const filesSection = issue.files_affected.length > 0
    ? `\n\n**Files affected:**\n${issue.files_affected.map(f => `- \`${f}\``).join('\n')}`
    : ''
  const skillsSection = issue.skills.length > 0
    ? `\n\n**Skills needed:** ${issue.skills.join(', ')}`
    : ''
  const body = [
    `**Task Description**`,
    issue.description,
    ``,
    `**Motivation**`,
    issue.why_beginner_friendly,
    ``,
    `**Type:** ${kindLabel} · **Difficulty:** ${issue.difficulty.toFixed(1)}/5 · **Estimated time:** ~${issue.estimated_hours}h`,
    filesSection,
    skillsSection,
    ``,
    `**Acceptance Criteria**`,
    `- [ ] `,
    ``,
    `> _This issue was suggested by [ContribIQ](https://github.com/nooriegarg/ContribIQ) codebase analysis._`,
  ].join('\n')

  const params = new URLSearchParams({
    title: issue.title,
    body,
    labels: 'good first issue',
  })
  return `https://github.com/${owner}/${repo}/issues/new?${params.toString()}`
}

function MatchRing({ pct }: { pct: number }) {
  const r = 26
  const circ = 2 * Math.PI * r
  const fill = (pct / 100) * circ
  const color = pct >= 70 ? '#22c55e' : pct >= 40 ? '#f59e0b' : '#6b7280'
  return (
    <div className="match-ring" aria-label={`AI match score ${pct}%`}>
      <svg viewBox="0 0 62 62" aria-hidden="true">
        <circle cx="31" cy="31" r={r} fill="none" stroke="#EAECEE" strokeWidth="5" />
        <circle cx="31" cy="31" r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
          transform="rotate(-90 31 31)" />
      </svg>
      <span className="match-text"><span className="match-pct">{pct}%</span><span className="match-lbl">Match</span></span>
    </div>
  )
}

export default function IssuesPage() {
  const { taskId, basePath, result } = useWorkflow()
  const { user } = useAuth()
  const [query, setQuery] = useState('')
  const [label, setLabel] = useState('')
  const matchCacheKey = `matches:${taskId}:${user?.id ?? 'anon'}`
  const [matches, setMatches] = useState<IssueMatch[] | null>(() => {
    try { const c = sessionStorage.getItem(matchCacheKey); return c ? JSON.parse(c) : null } catch { return null }
  })
  const [matchError, setMatchError] = useState('')
  const [matchLoading, setMatchLoading] = useState(matches === null)

  const [generatedIssues, setGeneratedIssues] = useState<GeneratedIssue[]>([])
  const [generatedLoading, setGeneratedLoading] = useState(true)
  const [showGenerated, setShowGenerated] = useState(false)

  useEffect(() => {
    if (!taskId || matches !== null) return
    let active = true
    setMatchLoading(true)
    setMatchError('')
    getMatchedIssues(taskId)
      .then(data => {
        if (!active) return
        setMatches(data)
        try { sessionStorage.setItem(matchCacheKey, JSON.stringify(data)) } catch { /* storage full */ }
      })
      .catch(err => { if (active) setMatchError(err instanceof Error ? err.message : 'Unable to load ranked issues.') })
      .finally(() => { if (active) setMatchLoading(false) })
    return () => { active = false }
  }, [taskId, matchCacheKey, matches])

  useEffect(() => {
    if (!taskId) return
    let active = true
    getGeneratedIssues(taskId)
      .then(data => { if (active) setGeneratedIssues(data) })
      .catch(() => {})
      .finally(() => { if (active) setGeneratedLoading(false) })
    return () => { active = false }
  }, [taskId])

  if (!result) return null

  const issues = getOpenIssues(result)
  const issueError = getIssueLoadError(result)
  const matchMap = new Map(matches?.map(m => [m.issue_number, m]) ?? [])

  const rankedIssues = [...issues].sort((a, b) => {
    const ma = matchMap.get(a.number)?.match_pct ?? -1
    const mb = matchMap.get(b.number)?.match_pct ?? -1
    return mb - ma
  })

  const labels = [...new Set(issues.flatMap(issue => issue.labels.map(item => item.name)))].sort((a, b) => a.localeCompare(b))
  const search = query.trim().toLowerCase()
  const filtered = rankedIssues.filter(issue =>
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
        {matchLoading && <p className="notice">Ranking issues based on your profile...</p>}
        {!matchLoading && matchError && <p className="notice">{matchError}</p>}
        {issueError ? <div className="notice error" role="alert">{issueError}<p className="mt8"><Link className="btn btn-s" to="/dashboard">Run a new analysis</Link></p></div> : (
          <>
            <div className="issue-filters">
              <label>Search issues<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Title, description, or issue number" /></label>
              <label>Label<select value={label} onChange={event => setLabel(event.target.value)}><option value="">All labels</option>{labels.map(name => <option value={name} key={name}>{name}</option>)}</select></label>
            </div>
            <p className="muted filter-count" role="status">{filtered.length} {filtered.length === 1 ? 'issue' : 'issues'} shown</p>
            {filtered.map(issue => {
              const match = matchMap.get(issue.number)
              return (
                <Link className="issue-card" to={`${basePath}/issues/${issue.number}`} key={issue.number}>
                  {match ? (
                    <MatchRing pct={match.match_pct} />
                  ) : (
                    <div className="match-ring" aria-label="AI match score unavailable">
                      <svg viewBox="0 0 62 62" aria-hidden="true"><circle cx="31" cy="31" r="26" fill="none" stroke="#EAECEE" strokeWidth="5" /></svg>
                      <span className="match-text"><span className="match-pct">--</span><span className="match-lbl">Unscored</span></span>
                    </div>
                  )}
                  <div className="issue-body">
                    <div className="issue-top">
                      <span className="issue-num">#{issue.number}</span>
                      <h2 className="issue-ttl">{issue.title}</h2>
                      {match
                        ? <span className={`badge ${match.match_pct >= 70 ? 'badge-green' : match.match_pct >= 40 ? 'badge-yellow' : 'badge-gray'}`}>{match.match_pct}% match</span>
                        : <span className="badge badge-gray">Not ranked</span>}
                    </div>
                    <p className="issue-desc">{issue.body ? `${issue.body.slice(0, 220)}${issue.body.length > 220 ? '...' : ''}` : 'No description provided. Open the issue to explore contribution guidance.'}</p>
                    <div className="issue-tags">{issue.labels.map(item => <span className={`badge ${item.name.toLowerCase() === 'good first issue' ? 'badge-green' : 'badge-blue'}`} key={item.name}>{item.name}</span>)}</div>
                    {match && match.reasons.length > 0 && (
                      <ul className="issue-reasons">{match.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
                    )}
                    {!match && <div className="issue-reasons"><p className="muted">View issue details and your contribution checklist<WorkflowIcon name="arrow" /></p></div>}
                  </div>
                  <span className="issue-arr"><WorkflowIcon name="arrow" /></span>
                </Link>
              )
            })}
            {filtered.length === 0 && <div className="card issue-empty"><h2 className="ctitle">{issues.length === 0 ? 'No open issues in this analysis' : 'No issues match your filters'}</h2><p className="muted">{issues.length === 0 ? 'Try another repository, or check GitHub for newer issues.' : 'Try a different search or select All labels.'}</p>{(query || label) && <button className="btn btn-s mt12" onClick={() => { setQuery(''); setLabel('') }}>Clear filters</button>}</div>}
          </>
        )}

        {/* AI-Generated Issue Suggestions */}
        {!generatedLoading && generatedIssues.length > 0 && (
          <div className="generated-issues-section">
            <div className="generated-header" onClick={() => setShowGenerated(o => !o)} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && setShowGenerated(o => !o)}>
              <div className="generated-header-left">
                <span className="generated-badge">AI Generated</span>
                <h3 className="generated-title">Suggested Issues from Codebase Analysis</h3>
                <p className="generated-sub">{generatedIssues.length} beginner-friendly opportunities found by scanning the source code</p>
              </div>
              <span className="generated-toggle">{showGenerated ? '▲ Hide' : '▼ Show'}</span>
            </div>
            {showGenerated && (
              <div className="generated-list">
                {generatedIssues.map((issue, i) => (
                  <div className="generated-card" key={i}>
                    <div className="generated-card-top">
                      <span className={`badge ${issue.gap_kind === 'untested' ? 'badge-yellow' : issue.gap_kind === 'missing_docstring' ? 'badge-blue' : 'badge-gray'}`}>
                        {issue.gap_kind === 'todo' ? 'TODO/FIXME' : issue.gap_kind === 'untested' ? 'Missing Tests' : 'Missing Docs'}
                      </span>
                      <span className="generated-difficulty">Difficulty {issue.difficulty.toFixed(1)}/5</span>
                      <span className="muted generated-hours">~{issue.estimated_hours}h</span>
                    </div>
                    <h4 className="generated-card-title">{issue.title}</h4>
                    <p className="generated-card-desc">{issue.description}</p>
                    <p className="generated-why"><strong>Why beginner-friendly:</strong> {issue.why_beginner_friendly}</p>
                    {issue.files_affected.length > 0 && (
                      <div className="generated-files">
                        <span className="muted">Files: </span>
                        {issue.files_affected.map(f => <code key={f} className="generated-file">{f}</code>)}
                      </div>
                    )}
                    {issue.skills.length > 0 && (
                      <div className="issue-tags">{issue.skills.map(s => <span className="badge badge-blue" key={s}>{s}</span>)}</div>
                    )}
                    <a
                      className="btn btn-s generated-open-btn"
                      href={buildGitHubIssueUrl(result.owner, result.repo, issue)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open on GitHub ↗
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <footer className="action-row"><p className="ar-hint">Select an issue to explore its details and plan your contribution.</p><Link className="btn btn-s" to={`${basePath}/profile`}>Back to Profile</Link></footer>    </section>
  )
}
