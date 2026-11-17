interface MatchRingProps {
  pct: number
  size?: number
}

const RADIUS = 26
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function MatchRing({ pct, size = 64 }: MatchRingProps) {
  const offset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE
  const color = pct >= 75 ? '#3fb950' : pct >= 50 ? '#d29922' : '#8b949e'

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label={`${pct}% match`}>
      <circle
        cx="32" cy="32" r={RADIUS}
        fill="none"
        stroke="rgba(255,255,255,0.08)"
        strokeWidth="5"
      />
      <circle
        cx="32" cy="32" r={RADIUS}
        fill="none"
        stroke={color}
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        transform="rotate(-90 32 32)"
        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
      />
      <text
        x="32" y="36"
        textAnchor="middle"
        fill={color}
        fontSize="13"
        fontWeight="600"
        fontFamily="var(--font, system-ui)"
      >
        {pct}%
      </text>
    </svg>
  )
}
