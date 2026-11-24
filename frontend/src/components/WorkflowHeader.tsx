import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import Avatar from './Avatar'
import { getAvatarUrl } from './WorkflowLayout'

export default function WorkflowHeader({
  title, subtitle, step, complete = false,
}: { title: string; subtitle: string; step: number; complete?: boolean }) {
  const { user } = useAuth()
  const avatarUrl = user ? getAvatarUrl(user.id) : null

  return (
    <header className="topbar">
      <div>
        <h1 className="t-title">{title}</h1>
        <p className="t-sub">{subtitle}</p>
      </div>
      <div className="t-right">
        {complete && <span className="badge badge-green">Analysis complete</span>}
        <span className="badge badge-blue">Step {step} of 5</span>
        {user && (
          <Link className="wh-avatar-link" to="/profile" title="My Profile">
            <Avatar name={user.name} avatarUrl={avatarUrl} size={34} />
          </Link>
        )}
      </div>
    </header>
  )
}
