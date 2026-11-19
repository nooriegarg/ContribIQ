import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getOnboardingPlan, type OnboardingPlan } from '../api/onboarding'
import { useWorkflow } from '../hooks/useWorkflow'
import IssuePreviewCard from '../components/IssuePreviewCard'
import Timeline from '../components/Timeline'
import WorkflowHeader from '../components/WorkflowHeader'
import WorkflowIcon from '../components/WorkflowIcon'
import { getOpenIssues } from '../utils/issues'

export default function OnboardingPage() {
  const { taskId, basePath, result } = useWorkflow()
  const [plan, setPlan] = useState<OnboardingPlan | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    setPlan(null)
    setError('')
    getOnboardingPlan(taskId)
      .then(data => { if (active) setPlan(data) })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load onboarding plan.') })
    return () => { active = false }
  }, [taskId, attempt])

  const issue = result ? getOpenIssues(result).find(item => item.number === plan?.issue_preview.number) : undefined
  return (
    <section className="screen active">
      <WorkflowHeader title="Your Onboarding Path" subtitle={`A guided walkthrough for ${result?.metadata.full_name}`} step={2} />
      <div className="page-body">
        {error ? <div className="notice error" role="alert">{error}<p>Plan generation requires the configured Ollama model to be available.</p><button className="btn btn-s mt12" onClick={() => setAttempt(attempt + 1)}>Try again</button></div>
          : !plan ? <p className="notice" role="status">Generating your onboarding plan...</p>
            : <div className="grid2">
              <section>
                <div className="section-intro"><p className="eyebrow">First {plan.estimated_minutes} Minutes</p><h2 className="pg-title">Your action plan</h2><p className="pg-desc">Complete these steps in order to understand the project before writing any code.</p></div>
                <Timeline steps={plan.steps} />
              </section>
              <aside>
                <div className="section-intro"><p className="eyebrow">Your First Contribution</p><h2 className="pg-title">Issue preview</h2><p className="pg-desc">A starting point to explore after your environment is ready.</p></div>
                <IssuePreviewCard verified={!!issue} issue={issue ? { number: issue.number, title: issue.title, description: issue.body ?? undefined, labels: issue.labels.map(label => label.name) } : plan.issue_preview} />
                <section className="card mt16">
                  <h3 className="ctitle"><span className="ctitle-icon"><WorkflowIcon name="clock" /></span>Time Investment</h3>
                  <div className="time-row"><span>Estimated onboarding time</span><strong>~{plan.estimated_minutes} min</strong></div>
                  <p className="muted mt12">AI-generated estimate. Actual setup time depends on the project and your environment.</p>
                </section>
                <section className="card tip-card mt16"><h3 className="ctitle">A good first contribution starts small</h3><p>Read CONTRIBUTING.md, check the project&apos;s setup instructions, and confirm the issue is still open before making changes.</p></section>
              </aside>
            </div>}
      </div>
      <footer className="action-row">
        <p className="ar-hint">Next: tell us about your skills and interests</p>
        <Link className="btn btn-s" to={basePath}>Back</Link>
        <Link className="btn btn-p" to={`${basePath}/profile`}>Tell Us About You<WorkflowIcon name="arrow" /></Link>
      </footer>
    </section>
  )
}
