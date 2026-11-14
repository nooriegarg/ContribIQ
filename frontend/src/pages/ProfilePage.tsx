import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { getProfile, updateProfile, type ContributorProfile } from '../api/profile'
import ChipSelector from '../components/ChipSelector'
import ExperienceSelector from '../components/ExperienceSelector'
import '../styles/workflow.css'

const languages = [
  { value: 'python', label: 'Python' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'java', label: 'Java' },
  { value: 'documentation', label: 'Documentation' },
]

const interests = [
  { value: 'backend', label: 'Backend / API' },
  { value: 'frontend', label: 'Frontend / UI' },
  { value: 'testing', label: 'Testing' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'devops', label: 'DevOps' },
  { value: 'database', label: 'Database' },
]

export default function ProfilePage() {
  const { taskId = '' } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<ContributorProfile | null>(null)
  const [languagesSelected, setLanguagesSelected] = useState<string[]>([])
  const [interestsSelected, setInterestsSelected] = useState<string[]>([])
  const [experience, setExperience] = useState<ContributorProfile['experience']>('beginner')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const updateQueue = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    let active = true
    getProfile()
      .then(data => {
        if (!active) return
        setProfile(data)
        setLanguagesSelected(data.languages ?? [])
        setInterestsSelected(data.interests ?? [])
        setExperience(data.experience ?? 'beginner')
      })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load your profile.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function toggleSelection(
    value: string,
    current: string[],
    setCurrent: (next: string[]) => void,
    field: 'languages' | 'interests',
  ) {
    const next = current.includes(value) ? current.filter(item => item !== value) : [...current, value]
    setCurrent(next)
    setNotice('')
    setError('')
    const request = updateQueue.current.then(async () => {
      const updated = await updateProfile({
        languages: field === 'languages' ? next : languagesSelected,
        interests: field === 'interests' ? next : interestsSelected,
        experience,
      })
      setProfile(updated)
    })
    updateQueue.current = request.then(() => undefined, () => undefined)
    try {
      await request
      setNotice('Profile updated')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save your profile.')
    }
  }

  async function handleContinue() {
    setSaving(true)
    setError('')
    try {
      await updateQueue.current
      await updateProfile({ languages: languagesSelected, interests: interestsSelected, experience })
      setNotice('Profile saved')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save your profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="workflow-page profile-page">
      <header className="workflow-header">
        <div>
          <Link className="workflow-brand" to="/dashboard">ContribIQ</Link>
          <h1>Your profile</h1>
          <p>Help us match you with the right issues.</p>
        </div>
        <span className="workflow-step">Step 3 of 5</span>
      </header>

      <section className="profile-content">
        <div className="section-kicker">Personalization</div>
        <h2>Tell us about yourself</h2>
        <p className="section-copy">We’ll use this to find issues that fit your current skills and learning goals.</p>

        {loading ? <div className="profile-loading">Loading profile…</div> : (
          <>
            {error && <div className="workflow-error" role="alert">{error}</div>}
            <section className="profile-section">
              <h3>Which languages are you comfortable with?</h3>
              <ChipSelector
                label="Programming languages and documentation"
                options={languages}
                selected={languagesSelected}
                onChange={value => void toggleSelection(value, languagesSelected, setLanguagesSelected, 'languages')}
              />
            </section>

            <section className="profile-section">
              <h3>What’s your open-source contribution experience?</h3>
              <ExperienceSelector value={experience} onChange={setExperience} />
            </section>

            <section className="profile-section">
              <h3>What are you interested in working on?</h3>
              <ChipSelector
                label="Areas of interest"
                options={interests}
                selected={interestsSelected}
                onChange={value => void toggleSelection(value, interestsSelected, setInterestsSelected, 'interests')}
              />
            </section>
            {notice && <p className="profile-notice" role="status">{notice}</p>}
          </>
        )}
      </section>

      <footer className="workflow-actions">
        <button className="button-secondary" onClick={() => navigate(`/overview/${encodeURIComponent(taskId)}/onboarding`)} type="button">Back</button>
        <button className="button-primary" disabled={loading || saving || !profile} onClick={() => void handleContinue()} type="button">
          {saving ? 'Saving…' : 'Save profile'} <span aria-hidden="true">→</span>
        </button>
      </footer>
    </main>
  )
}
