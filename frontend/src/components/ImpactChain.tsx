interface ImpactChainProps {
  components: string[]
}

export default function ImpactChain({ components }: ImpactChainProps) {
  if (components.length === 0) return null

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      {components.map((name, index) => (
        <div key={index} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
          <div style={{
            background: 'rgba(27,144,255,0.12)',
            border: '1px solid rgba(27,144,255,0.3)',
            color: 'var(--b4, #58a6ff)',
            borderRadius: 6,
            padding: '6px 14px',
            fontSize: 13,
            fontWeight: 500,
          }}>
            {name}
          </div>
          {index < components.length - 1 && (
            <div style={{
              width: 2,
              height: 16,
              background: 'rgba(255,255,255,0.15)',
              marginLeft: 18,
            }} />
          )}
        </div>
      ))}
    </div>
  )
}
