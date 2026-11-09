import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { type AnalysisResult, getAnalysisResult } from '../api/analyze'
import ArchDiagram from '../components/ArchDiagram'
import DirectoryMap from '../components/DirectoryMap'
import RepoBanner from '../components/RepoBanner'
import RepoStats from '../components/RepoStats'
import TechStack from '../components/TechStack'

export default function OverviewPage() {
  const { taskId } = useParams<{ taskId: string }>()
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!taskId) return
    getAnalysisResult(taskId)
      .then(setResult)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [taskId])

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ color: 'var(--gm)', fontSize: 14 }}>Loading analysis…</div>
      </div>
    )
  }

  if (error || !result) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ color: 'var(--red)', fontSize: 14 }}>{error ?? 'Analysis not found'}</div>
      </div>
    )
  }

  const { metadata, tech_stack, directory_map } = result

  return (
    <div style={{
      maxWidth: 960,
      margin: '0 auto',
      padding: '32px 24px',
      color: 'var(--white)',
      fontFamily: 'var(--font)',
    }}>
      <RepoBanner
        fullName={metadata.full_name ?? `${result.owner}/${result.repo}`}
        description={metadata.description}
        stars={metadata.stars}
        forks={metadata.forks}
        openIssues={metadata.open_issues}
        language={metadata.language}
        topics={metadata.topics}
      />

      <RepoStats
        stars={metadata.stars}
        forks={metadata.forks}
        openIssues={metadata.open_issues}
        language={metadata.language}
      />

      <TechStack stack={tech_stack} />

      <DirectoryMap directories={directory_map} />

      {taskId && (
        <ArchDiagram
          taskId={taskId}
          techStack={tech_stack}
          repoName={result.repo}
        />
      )}
    </div>
  )
}
