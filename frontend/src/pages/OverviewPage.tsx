import { Link } from 'react-router-dom'
import { useWorkflow } from '../hooks/useWorkflow'
import ArchDiagram from '../components/ArchDiagram'
import DirectoryMap from '../components/DirectoryMap'
import QAPanel from '../components/QAPanel'
import RepoBanner from '../components/RepoBanner'
import RepoStats from '../components/RepoStats'
import TechStack from '../components/TechStack'
import WorkflowHeader from '../components/WorkflowHeader'
import WorkflowIcon from '../components/WorkflowIcon'
import { getIssueLoadError, getOpenIssues } from '../utils/issues'

export default function OverviewPage() {
  const { taskId, basePath, result } = useWorkflow()
  if (!result) return null
  const { metadata, tech_stack, directory_map } = result
  const name = metadata.full_name || `${result.owner}/${result.repo}`
  const issueError = getIssueLoadError(result)
  const goodFirstIssues = issueError ? null : getOpenIssues(result).filter(issue =>
    issue.labels.some(label => label.name.toLowerCase() === 'good first issue')).length
  return (
    <section className="screen active">
      <WorkflowHeader title="Repository Overview" subtitle={`${name} - Repository analyzed`} step={1} complete />
      <RepoBanner fullName={name} description={metadata.description} stars={metadata.stars} forks={metadata.forks}
        openIssues={metadata.open_issues} language={metadata.language} topics={metadata.topics} />
      <div className="page-body">
        <div className="grid2"><TechStack stack={tech_stack} /><DirectoryMap directories={directory_map} /></div>
        <ArchDiagram taskId={taskId} repoName={result.repo} />
        <RepoStats openIssues={metadata.open_issues} goodFirstIssues={goodFirstIssues} testFileCount={result.test_file_count} testCoveragePct={result.test_coverage_pct} />
        <QAPanel taskId={taskId} />
        {issueError && <p className="notice error mt16" role="alert">{issueError}</p>}
      </div>
      <footer className="action-row">
        <p className="ar-hint">Next: we&apos;ll build your personalized first-30-minutes plan</p>
        <Link className="btn btn-p btn-lg" to={`${basePath}/onboarding`}><WorkflowIcon name="arrow" />Start Onboarding</Link>
      </footer>
    </section>
  )
}
