import WorkflowIcon from './WorkflowIcon'

const colors: Record<string, string> = {
  Python: '#3776ab', TypeScript: '#3178c6', JavaScript: '#b79300', React: '#008ca8',
  Docker: '#2496ed', Rust: '#ac5328', Go: '#007d9c', Java: '#cf4b27', pytest: '#563d7c',
}

export default function TechStack({ stack }: { stack: string[] }) {
  return (
    <section className="card">
      <h2 className="ctitle"><span className="ctitle-icon"><WorkflowIcon name="stack" /></span>Tech Stack</h2>
      <div className="tech-tags">
        {stack.map(tech => <span className="tech-tag" key={tech}><span className="tech-dot" style={{ background: colors[tech] ?? 'var(--b6)' }} />{tech}</span>)}
      </div>
      {stack.length === 0 && <p className="muted">No supported technology manifests were detected.</p>}
    </section>
  )
}
