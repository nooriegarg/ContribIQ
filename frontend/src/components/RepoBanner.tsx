import { formatCount } from '../utils/format'

interface RepoBannerProps {
  fullName: string
  description: string | null
  stars: number
  forks: number
  openIssues: number
  language: string | null
  topics: string[]
}

export default function RepoBanner({
  fullName,
  description,
  stars,
  forks,
  openIssues,
  language,
  topics,
}: RepoBannerProps) {
  const [owner, repo] = fullName.split('/')

  return (
    <div style={{
      background: 'var(--b11)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 'var(--r)',
      padding: '28px 32px',
      marginBottom: 24,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ color: 'var(--gm)', fontSize: 13, marginBottom: 4 }}>{owner} /</div>
          <h1 style={{ color: 'var(--white)', fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
            {repo}
          </h1>
          {description && (
            <p style={{ color: 'var(--gd)', fontSize: 14, lineHeight: 1.5, marginBottom: 12 }}>
              {description}
            </p>
          )}
          {topics.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {topics.map((t) => (
                <span key={t} style={{
                  background: 'rgba(27,144,255,0.15)',
                  color: 'var(--b4)',
                  borderRadius: 20,
                  padding: '2px 10px',
                  fontSize: 12,
                }}>
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 20, flexShrink: 0 }}>
          {[
            { label: 'Stars', value: formatCount(stars) },
            { label: 'Forks', value: formatCount(forks) },
            { label: 'Issues', value: formatCount(openIssues) },
            ...(language ? [{ label: 'Language', value: language }] : []),
          ].map(({ label, value }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--white)', fontWeight: 700, fontSize: 20 }}>{value}</div>
              <div style={{ color: 'var(--gm)', fontSize: 12 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
