interface Dimension {
  label: string
  score: number
}

interface ReadinessScoreProps {
  dimensions: Dimension[]
  overall: number
}

function barColor(score: number): string {
  if (score >= 75) return 'var(--green, #3fb950)'
  if (score >= 50) return '#d29922'
  return 'var(--gm, #8b949e)'
}

export default function ReadinessScore({ dimensions, overall }: ReadinessScoreProps) {
  return (
    <div>
      {dimensions.map(({ label, score }) => (
        <div key={label} style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 13, color: 'var(--gd, #c9d1d9)' }}>{label}</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--white, #e6edf3)' }}>
              {score}%
            </span>
          </div>
          <div style={{
            height: 6,
            background: 'rgba(255,255,255,0.08)',
            borderRadius: 3,
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, Math.max(0, score))}%`,
              background: barColor(score),
              borderRadius: 3,
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      ))}

      <div style={{
        borderTop: '1px solid rgba(255,255,255,0.08)',
        marginTop: 16,
        paddingTop: 12,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--white, #e6edf3)' }}>
          Overall Readiness
        </span>
        <span style={{
          fontSize: 22,
          fontWeight: 700,
          color: barColor(overall),
        }}>
          {overall}%
        </span>
      </div>
    </div>
  )
}
