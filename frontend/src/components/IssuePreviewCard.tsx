import type { IssuePreview } from '../api/onboarding'

export default function IssuePreviewCard({ issue, verified = false }: { issue: IssuePreview; verified?: boolean }) {
  return (
    <article className="explain-box">
      <div className="eyebrow">{verified ? `Open issue #${issue.number}` : 'AI-suggested starting point'}</div>
      <h3 className="ctitle">{issue.title}</h3>
      {issue.description && <p>{issue.description.slice(0, 360)}{issue.description.length > 360 ? '...' : ''}</p>}
      {!!issue.labels?.length && <div className="issue-tags mt12">{issue.labels.map(label => <span className="badge badge-blue" key={label}>{label}</span>)}</div>}
      {!verified && <p className="muted mt12">This suggestion has not been verified against the repository&apos;s open issues. Check issue discovery before starting.</p>}
    </article>
  )
}
