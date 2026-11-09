import { formatCount } from '../utils/format'

interface RepoStatsProps {
  stars: number
  forks: number
  openIssues: number
  language: string | null
}

export default function RepoStats({ stars, forks, openIssues, language }: RepoStatsProps) {
  const tiles = [
    { label: 'Open Issues', value: formatCount(openIssues), color: 'var(--b6)' },
    { label: 'Stars', value: formatCount(stars), color: '#f4d03f' },
    { label: 'Forks', value: formatCount(forks), color: 'var(--green)' },
    { label: 'Language', value: language ?? '—', color: 'var(--gd)' },
  ]

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
      gap: 12,
      marginBottom: 16,
    }}>
      {tiles.map(({ label, value, color }) => (
        <div key={label} style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 'var(--r)',
          padding: '18px 20px',
          textAlign: 'center',
        }}>
          <div style={{ color, fontWeight: 700, fontSize: 22, marginBottom: 4 }}>{value}</div>
          <div style={{ color: 'var(--gm)', fontSize: 12 }}>{label}</div>
        </div>
      ))}
    </div>
  )
}
