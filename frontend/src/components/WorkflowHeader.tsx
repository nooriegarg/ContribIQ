export default function WorkflowHeader({
  title, subtitle, step, complete = false,
}: { title: string; subtitle: string; step: number; complete?: boolean }) {
  return (
    <header className="topbar">
      <div>
        <h1 className="t-title">{title}</h1>
        <p className="t-sub">{subtitle}</p>
      </div>
      <div className="t-right">
        {complete && <span className="badge badge-green">Analysis complete</span>}
        <span className="badge badge-blue">Step {step} of 5</span>
      </div>
    </header>
  )
}
