import type { OnboardingStep } from '../api/onboarding'
import CodeBlock from './CodeBlock'
import FileReadList from './FileReadList'

interface Props {
  steps: OnboardingStep[]
}

export default function Timeline({ steps }: Props) {
  return (
    <ol className="onboarding-timeline">
      {steps.map((step, index) => (
        <li className={`timeline-step${index === 0 ? ' is-active' : ''}`} key={step.step}>
          <span className="timeline-marker" aria-hidden="true">{step.step}</span>
          <article className="timeline-card">
            <h3>{step.title}</h3>
            <p>{step.description}</p>
            <CodeBlock commands={step.commands ?? []} />
            <FileReadList files={step.files_to_read ?? []} />
          </article>
        </li>
      ))}
    </ol>
  )
}
