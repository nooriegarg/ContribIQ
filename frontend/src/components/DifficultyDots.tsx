interface DifficultyDotsProps {
  score: number
}

export default function DifficultyDots({ score }: DifficultyDotsProps) {
  const filled = Math.round(Math.min(5, Math.max(0, score)))
  return (
    <div style={{ display: 'flex', gap: 3 }} aria-label={`Difficulty ${filled} of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            background: i < filled ? '#d29922' : 'rgba(255,255,255,0.12)',
            display: 'inline-block',
          }}
        />
      ))}
    </div>
  )
}
