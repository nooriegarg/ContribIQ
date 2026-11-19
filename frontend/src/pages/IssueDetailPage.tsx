import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useWorkflow } from '../hooks/useWorkflow'
import { getIssueLoadError, getOpenIssues } from '../utils/issues'
import WorkflowHeader from '../components/WorkflowHeader'
import WorkflowIcon from '../components/WorkflowIcon'
import CodeBlock from '../components/CodeBlock'
import DirectoryMap from '../components/DirectoryMap'

const tabs = ['Understanding', 'Implementation', 'Similar PRs', 'Checklist', 'Readiness'] as const
const checklist = [
  'Read the issue description and discussion',
  'Read the repository README and contribution guidelines',
  'Confirm the issue is available and clarify the expected behavior',
  'Set up the project locally and reproduce the behavior',
  'Create a branch and make a focused change',
  'Add or update relevant tests and run the project checks',
  'Review the diff and open a pull request linked to the issue',
]

export default function IssueDetailPage() {
  const { issueNumber = '' } = useParams()
  const { taskId, basePath, result } = useWorkflow()
  const [tab, setTab] = useState(0)
  const [checklists, setChecklists] = useState<Record<string, number[]>>({})
  if (!result) return null
  const issue = /^\d+$/.test(issueNumber) ? getOpenIssues(result).find(item => item.number === Number(issueNumber)) : undefined
  const issueError = getIssueLoadError(result)
  const key = `${taskId}:${issueNumber}`
  const checked = checklists[key] ?? []
  const repoURL = `https://github.com/${result.owner}/${result.repo}`
  const issueURL = `${repoURL}/issues/${issue?.number ?? ''}`
  const githubLink = <a className="btn btn-p" href={issueURL} target="_blank" rel="noreferrer">View Issue on GitHub<WorkflowIcon name="arrow" /></a>

  if (!issue || issueError) return (
    <section className="screen active">
      <WorkflowHeader title="Issue Deep-Dive" subtitle="Issue details unavailable" step={5} />
      <div className="page-body"><div className="notice error" role="alert">{issueError ?? 'This open issue was not found in the repository analysis.'}</div><Link className="btn btn-s" to={`${basePath}/issues`}>Back to Issues</Link></div>
    </section>
  )

  return (
    <section className="screen active">
      <WorkflowHeader title="Issue Deep-Dive" subtitle={`${result.metadata.full_name} - Issue #${issue.number}`} step={5} />
      <div className="detail-banner">
        <p className="detail-num">{result.metadata.full_name} / #{issue.number}</p>
        <h2 className="detail-ttl">{issue.title}</h2>
        <div className="detail-meta"><span className="badge badge-green">Open at analysis time</span>{issue.user && <span className="dm-item">Opened by {issue.user.login}</span>}<span className="dm-item">AI match and difficulty: not scored</span></div>
        <div className="issue-tags mt12">{issue.labels.map(label => <span className="badge badge-blue" key={label.name}>{label.name}</span>)}</div>
      </div>
      <div className="page-body">
        <div className="tabs" role="tablist" aria-label="Issue detail sections">
          {tabs.map((name, index) => (
            <button type="button" className={`tab${tab === index ? ' active' : ''}`} role="tab" id={`detail-tab-${index}`}
              aria-selected={tab === index} aria-controls={`detail-panel-${index}`} tabIndex={tab === index ? 0 : -1}
              key={name} onClick={() => setTab(index)}
              onKeyDown={event => {
                let next: number
                if (event.key === 'ArrowRight') next = (index + 1) % tabs.length
                else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length
                else if (event.key === 'Home') next = 0
                else if (event.key === 'End') next = tabs.length - 1
                else return
                event.preventDefault()
                setTab(next)
                event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
              }}>{name}</button>
          ))}
        </div>
        <div role="tabpanel" tabIndex={0} id={`detail-panel-${tab}`} aria-labelledby={`detail-tab-${tab}`}>
          {tab === 0 && <div className="grid2">
            <div>
              <section className="card"><h3 className="ctitle"><span className="ctitle-icon"><WorkflowIcon name="code" /></span>Understanding the Issue</h3><div className="explain-box"><p>This is the original GitHub issue description. An AI explanation is not connected yet.</p></div><p className="issue-description mt16">{issue.body || 'No description was provided. Read the discussion on GitHub for more context.'}</p></section>
              <section className="card"><h3 className="ctitle">Before You Start</h3><div className="prereq-list">{['Read the project documentation', 'Check the issue discussion and expected behavior', 'Confirm the contribution process with maintainers'].map((text, index) => <div className="prereq-item" key={text}><span className="prereq-num">{index + 1}</span><p className="prereq-ttl">{text}</p></div>)}</div><p className="muted mt12">General contribution guidance, not an AI assessment of this issue.</p></section>
            </div>
            <div>
              <section className="card"><h3 className="ctitle">Files to Change</h3><p className="muted">Issue-specific file analysis is not connected. Review the repository directories and trace the behavior before choosing files to edit.</p></section>
              <div className="mt16"><DirectoryMap directories={result.directory_map} /></div>
              <section className="card mt16"><h3 className="ctitle">Impact Map</h3><p className="muted">An issue-specific dependency and impact map is not available yet. No affected components have been inferred.</p></section>
            </div>
          </div>}
          {tab === 1 && <div className="grid2">
            <section className="card"><h3 className="ctitle">Suggested Workflow</h3><p className="notice">General contribution steps. An issue-specific implementation plan is not connected yet.</p><ol className="prereq-list implementation-list">{['Confirm the bug or requested behavior with a minimal example.', 'Read the relevant code and existing tests before editing.', 'Make a small, focused change that follows the project conventions.', 'Run the documented checks and explain your changes in the pull request.'].map((text, index) => <li className="prereq-item" key={text}><span className="prereq-num">{index + 1}</span><span className="prereq-ttl">{text}</span></li>)}</ol></section>
            <section className="card"><h3 className="ctitle">Explore the Repository</h3><p className="muted">Clone the repository to inspect its code. If you plan to contribute through a fork, clone your fork instead.</p><CodeBlock commands={[`git clone ${repoURL}.git`, `cd ${result.repo}`]} /><p className="muted mt16">Follow the repository&apos;s README and contribution guidelines for setup and test commands.</p><a className="btn btn-s mt16" href={repoURL} target="_blank" rel="noreferrer">Open Repository</a></section>
          </div>}
          {tab === 2 && <section className="card"><h3 className="ctitle">Learn from Merged Pull Requests</h3><p className="notice">Similar-PR search is not connected yet. No similarity-ranked pull requests are available.</p><p className="muted">Browse the repository&apos;s merged pull requests to learn its contribution conventions. These have not been matched to this issue.</p><a className="btn btn-p mt16" href={`${repoURL}/pulls?q=is%3Apr+is%3Amerged`} target="_blank" rel="noreferrer">Browse Merged Pull Requests<WorkflowIcon name="arrow" /></a></section>}
          {tab === 3 && <section className="card">
            <h3 className="ctitle">Your Contribution Checklist</h3><p className="checklist-progress" role="status">{checked.length} of {checklist.length} complete. Local checklist; not saved to your account.</p>
            <div className="checklist">{checklist.map((text, index) => <label className={`cl-item${checked.includes(index) ? ' checked' : ''}`} key={text}><input type="checkbox" checked={checked.includes(index)} onChange={() => setChecklists(previous => {
              const items = previous[key] ?? []
              return { ...previous, [key]: items.includes(index) ? items.filter(item => item !== index) : [...items, index] }
            })} /><span className="cl-txt">{text}</span></label>)}</div>
          </section>}
          {tab === 4 && <div className="grid2">
            <section className="card"><h3 className="ctitle">Contribution Readiness</h3><div className="readiness-score"><div className="rs-big">Not scored</div><p className="rs-lbl">AI readiness assessment is not connected</p></div><p className="muted readiness-note">A readiness score requires validated onboarding, environment, code, testing, and issue-understanding data. We do not have those measurements yet.</p><div className="cta-box"><h4 className="cta-ttl">Ready to explore the issue?</h4><p className="cta-sub">Confirm the latest discussion and availability on GitHub.</p><a className="cta-btn" href={issueURL} target="_blank" rel="noreferrer">View Issue on GitHub</a></div></section>
            <section className="card"><h3 className="ctitle">Your Checklist Progress</h3><div className="readiness-score"><div className="rs-big">{checked.length}/{checklist.length}</div><p className="rs-lbl">Checklist items completed</p></div><p className="muted readiness-note">Self-reported checklist progress, not an AI readiness score or skill assessment.</p><button className="btn btn-s mt16" onClick={() => setTab(3)}>Review Checklist</button></section>
          </div>}
        </div>
      </div>
      <footer className="action-row"><p className="ar-hint">Verify the latest issue status on GitHub before starting.</p><Link className="btn btn-s" to={`${basePath}/issues`}>Back to Issues</Link>{githubLink}</footer>
    </section>
  )
}
