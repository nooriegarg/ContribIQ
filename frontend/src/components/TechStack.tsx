const TECH_COLORS: Record<string, { bg: string; fg: string }> = {
  Python:           { bg: '#3b4e6c', fg: '#4ec9b0' },
  TypeScript:       { bg: '#1a3a5c', fg: '#4fc1ff' },
  'Node.js':        { bg: '#2a3f2a', fg: '#6dbf67' },
  React:            { bg: '#1e3a4f', fg: '#61dafb' },
  Go:               { bg: '#1a3f4f', fg: '#79d4f1' },
  Rust:             { bg: '#4a2a1a', fg: '#f4a261' },
  Java:             { bg: '#4a3a1a', fg: '#f4d03f' },
  Ruby:             { bg: '#4a1a1a', fg: '#e74c3c' },
  PHP:              { bg: '#2a2a4a', fg: '#9b59b6' },
  Docker:           { bg: '#1a3a5c', fg: '#2980b9' },
  'GitHub Actions': { bg: '#1a3a1a', fg: '#2ecc71' },
}

const DEFAULT_COLOR = { bg: 'rgba(255,255,255,0.06)', fg: 'var(--gd)' }

interface TechStackProps {
  stack: string[]
}

export default function TechStack({ stack }: TechStackProps) {
  if (stack.length === 0) return null

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 'var(--r)',
      padding: '20px 24px',
      marginBottom: 16,
    }}>
      <h2 style={{ color: 'var(--white)', fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
        Tech Stack
      </h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {stack.map((tech) => {
          const { bg, fg } = TECH_COLORS[tech] ?? DEFAULT_COLOR
          return (
            <span key={tech} style={{
              background: bg,
              color: fg,
              borderRadius: 6,
              padding: '5px 12px',
              fontSize: 13,
              fontWeight: 500,
            }}>
              {tech}
            </span>
          )
        })}
      </div>
    </div>
  )
}
