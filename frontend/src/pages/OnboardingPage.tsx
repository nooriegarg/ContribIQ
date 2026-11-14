import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { OnboardingPlan } from '../api/onboarding'
import { getOnboardingPlan } from '../api/onboarding'
import IssuePreviewCard from '../components/IssuePreviewCard'
import Timeline from '../components/Timeline'
import '../styles/workflow.css'

export default function OnboardingPage() {
  const { taskId = '' } = useParams()
  const navigate = useNavigate()
  const [plan, setPlan] = useState<OnboardingPlan | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getOnboardingPlan(taskId)
      .then(data => { if (active) setPlan(data) })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load onboarding plan.') })
    return () => { active = false }
  }, [taskId])

  if (!plan && !error) return null

  return (
    <main className="workflow-page">
      <header className="workflow-header">
        <div>
          <Link className="workflow-brand" to="/dashboard">ContribIQ</Link>
          <h1>Your onboarding path</h1>
          <p>A guided walkthrough to help you make your first contribution.</p>
        </div>
        <span className="workflow-step">Step 2 of 5</span>
      </header>

      {error ? <div className="workflow-error" role="alert">{error}</div> : plan && (
        <div className="onboarding-layout">
          <section className="onboarding-main">
            <div className="section-kicker">First 30 minutes</div>
            <h2>Your action plan</h2>
            <p className="section-copy">Complete these steps in order to understand the project before writing code.</p>
            <Timeline steps={plan.steps} />
          </section>
          <aside className="onboarding-aside">
            <div className="section-kicker">Your first contribution</div>
            <h2>Issue preview</h2>
            <p className="section-copy">A starter issue selected from the repository analysis.</p>
            <IssuePreviewCard issue={plan.issue_preview} />
            <div className="time-summary">
              <span>Estimated onboarding time</span>
              <strong>~{plan.estimated_minutes} min</strong>
            </div>
          </aside>
        </div>
      )}

      <footer className="workflow-actions">
        <button className="button-secondary" onClick={() => navigate('/dashboard')} type="button">Back</button>
        <button className="button-primary" onClick={() => navigate(`/overview/${encodeURIComponent(taskId)}/profile`)} type="button">
          Tell us about you <span aria-hidden="true">→</span>
        </button>
      </footer>
    </main>
  )
}
