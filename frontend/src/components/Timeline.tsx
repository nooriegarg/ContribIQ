import type { OnboardingStep } from '../api/onboarding'
import CodeBlock from './CodeBlock'
import FileReadList from './FileReadList'

interface Props {
  steps: OnboardingStep[]
}

export default function Timeline({ steps }: Props) {
  return (
    <ol className="tl-wrap">
      {steps.map((step, index) => (
        <li className={`tl-item${index === 0 ? ' active' : ''}`} key={step.step}>
          <span className="tl-dot" aria-hidden="true">{step.step}</span>
          <article className="tl-card">
            <h3 className="tl-ttl">{step.title}</h3>
            <p className="tl-dsc">{step.description}</p>
            <CodeBlock commands={step.commands ?? []} />
            <FileReadList files={step.files_to_read ?? []} />
          </article>
        </li>
      ))}
    </ol>
  )
}
