import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { updateProfile, type ContributorProfile } from '../api/profile'
import ChipSelector from '../components/ChipSelector'
import ExperienceSelector from '../components/ExperienceSelector'
import WorkflowIcon from '../components/WorkflowIcon'
import { useAuth } from '../context/useAuth'
import { INTEREST_OPTIONS, LANGUAGE_OPTIONS } from '../data/profileOptions'
import '../styles/background.css'
import '../styles/components.css'
import '../styles/login.css'
import '../styles/onboarding-setup.css'

const TIME_OPTIONS = [
  { value: 'short', label: '~1 hour', description: 'A quick, focused change' },
  { value: 'medium', label: '2–3 hours', description: 'Time to explore and build' },
  { value: 'long', label: 'Half a day', description: 'A deeper contribution' },
]

const STEPS = [
  'Languages',
  'Experience',
  'Interests',
  'Time',
]

export default function OnboardingSetupPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [languages, setLanguages] = useState<string[]>([])
  const [experience, setExperience] = useState<ContributorProfile['experience']>('beginner')
  const [interests, setInterests] = useState<string[]>([])
  const [timeAvailable, setTimeAvailable] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const firstName = user?.name?.split(' ')[0] ?? 'there'

  function canAdvance() {
    if (step === 0) return languages.length > 0
    if (step === 2) return interests.length > 0
    return true
  }

  async function handleFinish() {
    setSaving(true)
    setError('')
    try {
      await updateProfile({ languages, experience, interests })
      navigate('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save profile. Please try again.')
      setSaving(false)
    }
  }

  function handleNext() {
    if (step < STEPS.length - 1) setStep(s => s + 1)
    else void handleFinish()
  }

  return (
    <div className="setup-page">
      <div className="setup-card">
        {/* Header */}
        <div className="setup-header">
          <div className="setup-brand">
            <WorkflowIcon name="cube" />
            <span>ContribIQ</span>
          </div>
          {step === 0 && (
            <div className="setup-welcome">
              <h1 className="setup-title">Welcome, {firstName}!</h1>
              <p className="setup-subtitle">Let's personalize your experience. It takes under a minute.</p>
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="setup-progress" aria-label="Setup progress">
          {STEPS.map((label, i) => (
            <div
              key={label}
              className={`setup-pip${i < step ? ' done' : i === step ? ' active' : ''}`}
              aria-current={i === step ? 'step' : undefined}
            />
          ))}
        </div>
        <p className="setup-step-label">Step {step + 1} of {STEPS.length}</p>

        {/* Step content */}
        <div className="setup-body">
          {step === 0 && (
            <section>
              <h2 className="setup-q">Which languages are you comfortable with?</h2>
              <p className="setup-hint">Select all that apply — this helps us match you to relevant issues.</p>
              <ChipSelector
                label="Programming languages"
                options={LANGUAGE_OPTIONS}
                selected={languages}
                onChange={v => setLanguages(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])}
                allowCustom
              />
            </section>
          )}

          {step === 1 && (
            <section>
              <h2 className="setup-q">What's your open-source contribution experience?</h2>
              <p className="setup-hint">We'll calibrate issue difficulty to your level.</p>
              <ExperienceSelector value={experience} onChange={setExperience} />
            </section>
          )}

          {step === 2 && (
            <section>
              <h2 className="setup-q">What are you interested in working on?</h2>
              <p className="setup-hint">Choose one or more areas you'd enjoy contributing to.</p>
              <ChipSelector
                label="Areas of interest"
                options={INTEREST_OPTIONS}
                selected={interests}
                onChange={v => setInterests(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])}
                allowCustom
              />
            </section>
          )}

          {step === 3 && (
            <section>
              <h2 className="setup-q">How much time do you have for your first contribution?</h2>
              <p className="setup-hint">We'll prioritize issues that fit your schedule.</p>
              <div className="radio-row" role="radiogroup" aria-label="Time availability">
                {TIME_OPTIONS.map(({ value, label, description }) => (
                  <label className={`radio-card${timeAvailable === value ? ' sel' : ''}`} key={value}>
                    <input
                      className="choice-radio"
                      name="time"
                      type="radio"
                      checked={timeAvailable === value}
                      onChange={() => setTimeAvailable(value)}
                    />
                    <span className="rc-icon"><WorkflowIcon name="clock" /></span>
                    <span className="rc-lbl">{label}</span>
                    <span className="rc-sub">{description}</span>
                  </label>
                ))}
              </div>
            </section>
          )}
        </div>

        {error && <p className="setup-error" role="alert">{error}</p>}

        {/* Footer */}
        <div className="setup-footer">
          {step > 0 && (
            <button className="btn btn-s" onClick={() => setStep(s => s - 1)} disabled={saving}>
              Back
            </button>
          )}
          <div className="setup-footer-right">
            {step === STEPS.length - 1 && (
              <button className="btn btn-s setup-skip" onClick={() => navigate('/dashboard')} disabled={saving}>
                Skip for now
              </button>
            )}
            <button
              className="btn btn-p"
              onClick={handleNext}
              disabled={saving || !canAdvance()}
            >
              {saving ? 'Saving…' : step === STEPS.length - 1 ? 'Go to Dashboard' : 'Next'}
              {!saving && <WorkflowIcon name="arrow" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
