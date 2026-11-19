import { formatCount } from '../utils/format'
import WorkflowIcon from './WorkflowIcon'

interface Props {
  fullName: string
  description: string | null
  stars: number
  forks: number
  openIssues: number
  language: string | null
  topics: string[]
}

export default function RepoBanner({ fullName, description, stars, forks, openIssues, language, topics }: Props) {
  return (
    <section className="repo-banner" aria-label="Repository details">
      <span className="rb-icon"><WorkflowIcon name="cube" /></span>
      <div>
        <h2 className="rb-name"><a href={`https://github.com/${fullName}`} target="_blank" rel="noreferrer">{fullName}</a></h2>
        <p className="rb-desc">{description || 'No repository description provided.'}</p>
        <div className="rb-meta">
          <span className="rb-mi">{formatCount(stars)} stars</span>
          <span className="rb-mi">{formatCount(forks)} forks</span>
          <span className="rb-mi">{formatCount(openIssues)} open issues</span>
          {language && <span className="rb-mi">{language}</span>}
        </div>
        {topics.length > 0 && <div className="profile-chips">{topics.map(topic => <span className="p-chip" key={topic}>{topic}</span>)}</div>}
      </div>
    </section>
  )
}
