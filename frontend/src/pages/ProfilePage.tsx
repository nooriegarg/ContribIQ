import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProfile, updateProfile, type ContributorProfile } from '../api/profile'
import ChipSelector from '../components/ChipSelector'
import ExperienceSelector from '../components/ExperienceSelector'
import WorkflowHeader from '../components/WorkflowHeader'
import WorkflowIcon from '../components/WorkflowIcon'
import { INTEREST_OPTIONS, LANGUAGE_OPTIONS } from '../data/profileOptions'
import { useWorkflow } from '../hooks/useWorkflow'
import { useAuth } from '../context/useAuth'

export default function ProfilePage() {
  const { taskId, basePath } = useWorkflow()
  const { user } = useAuth()
  const navigate = useNavigate()
  const cacheKey = `profile:${user?.id ?? 'me'}`
  const [profile, setProfile] = useState<ContributorProfile | null>(() => {
    try { const c = sessionStorage.getItem(cacheKey); return c ? JSON.parse(c) : null } catch { return null }
  })
  const [languagesSelected, setLanguagesSelected] = useState<string[]>(() => {
    try { const c = sessionStorage.getItem(cacheKey); return c ? JSON.parse(c).languages ?? [] : [] } catch { return [] }
  })
  const [interestsSelected, setInterestsSelected] = useState<string[]>(() => {
    try { const c = sessionStorage.getItem(cacheKey); return c ? JSON.parse(c).interests ?? [] : [] } catch { return [] }
  })
  const [experience, setExperience] = useState<ContributorProfile['experience']>(() => {
    try { const c = sessionStorage.getItem(cacheKey); return c ? JSON.parse(c).experience ?? 'beginner' : 'beginner' } catch { return 'beginner' }
  })
  const [loading, setLoading] = useState(!sessionStorage.getItem(cacheKey))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [timeAvailable, setTimeAvailable] = useState('')
  const [attempt, setAttempt] = useState(0)
  const updateQueue = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    if (profile) return
    let active = true
    setLoading(true)
    setError('')
    getProfile()
      .then(data => {
        if (!active) return
        setProfile(data)
        setLanguagesSelected(data.languages ?? [])
        setInterestsSelected(data.interests ?? [])
        setExperience(data.experience ?? 'beginner')
        sessionStorage.setItem(cacheKey, JSON.stringify(data))
      })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load your profile.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [attempt])

  function clearMatchesCache() {
    try { sessionStorage.removeItem(`matches:${taskId}:${user?.id ?? 'anon'}`) } catch { /* storage unavailable */ }
  }

  async function toggleSelection(
    value: string,
    current: string[],
    setCurrent: (next: string[]) => void,
    field: 'languages' | 'interests',
  ) {
    const next = current.includes(value) ? current.filter(item => item !== value) : [...current, value]
    setCurrent(next)
    setError('')
    const request = updateQueue.current.then(async () => {
      const updated = await updateProfile({ [field]: next })
      setProfile(updated)
      sessionStorage.setItem(cacheKey, JSON.stringify(updated))
      clearMatchesCache()
    })
    updateQueue.current = request.then(() => undefined, () => undefined)
    try {
      await request
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save your profile.')
    }
  }

  async function handleContinue() {
    setSaving(true)
    setError('')
    try {
      await updateQueue.current
      const updated = await updateProfile({ languages: languagesSelected, interests: interestsSelected, experience })
      sessionStorage.setItem(cacheKey, JSON.stringify(updated))
      clearMatchesCache()
      setNotice('Profile saved')
      navigate(`${basePath}/issues`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save your profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="screen active">
      <WorkflowHeader title="Your Contributor Profile" subtitle="Help us understand your skills and interests" step={3} />
      <div className="page-body profile-body">
        <div className="section-intro">
          <div className="eyebrow">Personalization</div>
          <h2 className="pg-title">Tell us about yourself</h2>
          <p className="pg-desc">Choose your skills and learning goals. You can update these anytime.</p>
        </div>
        {error && <div className="notice error" role="alert">{error}{!profile && <button className="btn btn-s mt12" onClick={() => setAttempt(attempt + 1)}>Try again</button>}</div>}
        {loading ? <p className="profile-loading" role="status">Loading profile...</p> : profile && (
          <fieldset className="profile-controls" disabled={saving}>
            <div className="profile-grid">
            <section className="card">
              <h3 className="profile-q">Which languages are you comfortable with?</h3>
              <ChipSelector
                label="Programming languages and documentation"
                options={LANGUAGE_OPTIONS}
                selected={languagesSelected}
                onChange={value => void toggleSelection(value, languagesSelected, setLanguagesSelected, 'languages')}
              />
            </section>

            <section className="card">
              <h3 className="profile-q">What’s your open-source contribution experience?</h3>
              <ExperienceSelector value={experience} onChange={setExperience} />
            </section>

            <section className="card">
              <h3 className="profile-q">What are you interested in working on?</h3>
              <ChipSelector
                label="Areas of interest"
                options={INTEREST_OPTIONS}
                selected={interestsSelected}
                onChange={value => void toggleSelection(value, interestsSelected, setInterestsSelected, 'interests')}
              />
            </section>
            <section className="card">
              <h3 className="profile-q">How much time do you have for your first contribution?</h3>
              <div className="radio-row" role="radiogroup" aria-label="Time availability">
                {[['short', '~1 hour', 'A quick, focused change'], ['medium', '2–3 hours', 'Time to explore and build'], ['long', 'Half a day', 'A deeper contribution']].map(([value, label, description]) => (
                  <label className={`radio-card${timeAvailable === value ? ' sel' : ''}`} key={value}>
                    <input className="choice-radio" name="time" type="radio" checked={timeAvailable === value} onChange={() => setTimeAvailable(value)} />
                    <span className="rc-icon"><WorkflowIcon name="clock" /></span><span className="rc-lbl">{label}</span><span className="rc-sub">{description}</span>
                  </label>
                ))}
              </div>
              <p className="muted time-choice-note">Planning preference for this visit only. Time availability is not saved or used for issue ranking yet.</p>
            </section>
            </div>
            {notice && <p className="notice success mt16" role="status">{notice}</p>}
          </fieldset>
        )}
      </div>
      <footer className="action-row">
        <p className="ar-hint">Your skills and interests are saved to your contributor profile.</p>
        <button className="btn btn-s" onClick={() => navigate(-1)} type="button">← Back</button>
        <button className="btn btn-p" disabled={loading || saving || !profile} onClick={() => void handleContinue()} type="button">
          {saving ? 'Saving…' : 'Find My Issues'}<WorkflowIcon name="arrow" />
        </button>
      </footer>
    </section>
  )
}
