import { formatCount } from '../utils/format'

export default function RepoStats({
  openIssues,
  goodFirstIssues,
  testFileCount,
  testCoveragePct,
}: {
  openIssues: number
  goodFirstIssues: number | null
  testFileCount?: number
  testCoveragePct?: number
}) {
  const coverageValue = testCoveragePct != null
    ? `${testCoveragePct}%`
    : testFileCount != null
      ? `${testFileCount} test files`
      : 'Not available'
  const coverageColor = testCoveragePct != null || testFileCount
    ? 'var(--green)'
    : 'var(--b10)'

  return (
    <section className="grid3 mt16" aria-label="Repository statistics" style={{ gridColumn: 'span 2' }}>
      {[
        { label: 'Open Issues', value: formatCount(openIssues), color: 'var(--b6)' },
        { label: 'Good First Issues in Analysis', value: goodFirstIssues === null ? 'Not available' : formatCount(goodFirstIssues), color: 'var(--green)' },
        { label: 'Test Coverage', value: coverageValue, color: coverageColor },
      ].map(tile => (
        <div className="card stat-card" key={tile.label}><div className="stat-value" style={{ color: tile.color }}>{tile.value}</div><div className="stat-label">{tile.label}</div></div>
      ))}
    </section>
  )
}
