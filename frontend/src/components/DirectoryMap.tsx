import WorkflowIcon from './WorkflowIcon'

export default function DirectoryMap({ directories }: { directories: { directory: string; description: string }[] }) {
  return (
    <section className="card">
      <h2 className="ctitle"><span className="ctitle-icon"><WorkflowIcon name="folder" /></span>Important Directories</h2>
      <div className="dir-list">
        {directories.map(({ directory, description }) => (
          <div className="dir-row" key={directory}><code className="dir-name">{directory}</code><span className="dir-sep" aria-hidden="true">&rarr;</span><span className="dir-desc">{description}</span></div>
        ))}
        {directories.length === 0 && <p className="muted">No directory map is available for this analysis.</p>}
      </div>
    </section>
  )
}
