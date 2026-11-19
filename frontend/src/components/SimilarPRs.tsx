export interface SimilarPR {
  number: number
  title: string
  url: string | null
}

interface SimilarPRsProps {
  prs: SimilarPR[]
}

export default function SimilarPRs({ prs }: SimilarPRsProps) {
  if (prs.length === 0) {
    return (
      <p style={{ color: 'var(--gm, #8b949e)', fontSize: 13 }}>
        No similar pull requests found.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {prs.map(pr => (
        <div
          key={pr.number}
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--gm, #8b949e)', flexShrink: 0 }}>
            #{pr.number}
          </span>
          {pr.url ? (
            <a
              href={pr.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13, color: 'var(--b4, #58a6ff)', textDecoration: 'none' }}
            >
              {pr.title}
            </a>
          ) : (
            <span style={{ fontSize: 13, color: 'var(--gd, #c9d1d9)' }}>{pr.title}</span>
          )}
        </div>
      ))}
    </div>
  )
}
