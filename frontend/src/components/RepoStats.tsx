import { formatCount } from '../utils/format'

export default function RepoStats({ openIssues, goodFirstIssues }: { openIssues: number; goodFirstIssues: number | null }) {
  return (
    <section className="grid3 mt16" aria-label="Repository statistics">
      {[
        { label: 'Open Issues', value: formatCount(openIssues), color: 'var(--b6)' },
        { label: 'Good First Issues in Analysis', value: goodFirstIssues === null ? 'Not available' : formatCount(goodFirstIssues), color: 'var(--green)' },
        { label: 'Test Coverage', value: 'Not available', color: 'var(--b10)' },
      ].map(tile => (
        <div className="card stat-card" key={tile.label}><div className="stat-value" style={{ color: tile.color }}>{tile.value}</div><div className="stat-label">{tile.label}</div></div>
      ))}
    </section>
  )
}
