import type { IssuePreview } from '../api/onboarding'

interface Props {
  issue: IssuePreview
}

export default function IssuePreviewCard({ issue }: Props) {
  const difficulty = typeof issue.difficulty === 'number'
    ? Math.max(1, Math.min(5, Math.round(issue.difficulty)))
    : null

  return (
    <article className="issue-preview">
      <div className="issue-preview-eyebrow">First contribution</div>
      <h3>{issue.title}</h3>
      {issue.description && <p>{issue.description}</p>}
      {!!issue.labels?.length && (
        <div className="issue-labels">
          {issue.labels.map(label => <span key={label}>{label}</span>)}
        </div>
      )}
      <div className="issue-difficulty">
        {difficulty !== null && (
          <span className="difficulty-bars" aria-hidden="true">
            {Array.from({ length: 5 }, (_, index) => (
              <i className={index < difficulty ? 'is-filled' : ''} key={index} />
            ))}
          </span>
        )}
        <span>{difficulty === null ? `Difficulty: ${issue.difficulty}` : `Difficulty ${difficulty}/5`}</span>
      </div>
    </article>
  )
}
