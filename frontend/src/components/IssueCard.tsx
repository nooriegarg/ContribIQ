import DifficultyDots from './DifficultyDots'
import MatchRing from './MatchRing'

export interface IssueMatch {
  issue_id: string
  match_pct: number
  reasons: [string, string, string]
  title: string
  number: number
  url: string | null
  difficulty: number
  labels: string[]
}

interface IssueCardProps {
  issue: IssueMatch
  isBest?: boolean
}

export default function IssueCard({ issue, isBest }: IssueCardProps) {
  return (
    <article style={{
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${isBest ? '#3fb950' : 'rgba(255,255,255,0.08)'}`,
      borderRadius: 8,
      padding: '16px 20px',
      display: 'flex',
      gap: 16,
      alignItems: 'flex-start',
    }}>
      <div style={{ flexShrink: 0 }}>
        <MatchRing pct={issue.match_pct} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          {isBest && (
            <span style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#3fb950',
              background: 'rgba(63,185,80,0.12)',
              border: '1px solid rgba(63,185,80,0.3)',
              borderRadius: 4,
              padding: '2px 6px',
            }}>
              Best match
            </span>
          )}
          <span style={{ fontSize: 12, color: '#8b949e' }}>#{issue.number}</span>
          {issue.labels.map(label => (
            <span key={label} style={{
              fontSize: 11,
              color: '#8b949e',
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 4,
              padding: '1px 6px',
            }}>
              {label}
            </span>
          ))}
        </div>

        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e6edf3', margin: '0 0 8px' }}>
          {issue.url ? (
            <a href={issue.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
              {issue.title}
            </a>
          ) : issue.title}
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: '#8b949e' }}>Difficulty</span>
          <DifficultyDots score={issue.difficulty} />
        </div>

        <ul style={{ margin: 0, padding: '0 0 0 16px' }}>
          {issue.reasons.map((reason, i) => (
            <li key={i} style={{ fontSize: 13, color: '#8b949e', marginBottom: 2 }}>{reason}</li>
          ))}
        </ul>
      </div>
    </article>
  )
}
