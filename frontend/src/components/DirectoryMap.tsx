interface DirectoryMapProps {
  directories: { directory: string; description: string }[]
}

export default function DirectoryMap({ directories }: DirectoryMapProps) {
  if (directories.length === 0) return null

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 'var(--r)',
      padding: '20px 24px',
      marginBottom: 16,
    }}>
      <h2 style={{ color: 'var(--white)', fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
        Directory Map
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {directories.map(({ directory, description }) => (
          <div key={directory} style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <code style={{
              color: 'var(--b4)',
              background: 'rgba(27,144,255,0.1)',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 12,
              fontFamily: 'monospace',
              flexShrink: 0,
            }}>
              {directory}
            </code>
            <span style={{ color: 'var(--gd)', fontSize: 13 }}>{description}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
