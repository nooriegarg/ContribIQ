import { useState } from 'react'
import type { OnboardingStep } from '../api/onboarding'
import CodeBlock from './CodeBlock'
import FileReadList from './FileReadList'

interface Props {
  steps: OnboardingStep[]
  storageKey?: string
}

export default function Timeline({ steps, storageKey }: Props) {
  const [currentStep, setCurrentStep] = useState(() => {
    if (!storageKey) return 0
    const saved = sessionStorage.getItem(`tl-step-${storageKey}`)
    return saved ? Math.min(parseInt(saved, 10), steps.length - 1) : 0
  })

  const goToStep = (n: number) => {
    setCurrentStep(n)
    if (storageKey) sessionStorage.setItem(`tl-step-${storageKey}`, String(n))
  }

  return (
    <ol className="tl-wrap">
      {steps.map((step, index) => {
        const isDone = index < currentStep
        const isActive = index === currentStep
        const isLocked = index > currentStep

        let className = 'tl-item'
        if (isActive) className += ' active'
        if (isDone) className += ' done'
        if (isLocked) className += ' locked'

        return (
          <li className={className} key={step.step}>
            <span className="tl-dot" aria-hidden="true">
              {isDone ? '✓' : step.step}
            </span>
            <article className="tl-card">
              <h3 className="tl-ttl">{step.title}</h3>
              {isLocked && <p className="tl-locked-hint">Complete the previous step to unlock</p>}
              {!isLocked && (
                <>
                  <p className="tl-dsc">{step.description}</p>
                  <CodeBlock commands={step.commands ?? []} />
                  <FileReadList files={step.files_to_read ?? []} />
                  {isActive && index < steps.length - 1 && (
                    <button
                      className="btn btn-p btn-s tl-next-btn"
                      onClick={() => goToStep(currentStep + 1)}
                    >
                      Next Step →
                    </button>
                  )}
                </>
              )}
            </article>
          </li>
        )
      })}
    </ol>
  )
}
