import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { updateCurrentUser } from '../api/auth'
import { getProfile, updateProfile, type ContributorProfile } from '../api/profile'
import Avatar from '../components/Avatar'
import ChipSelector from '../components/ChipSelector'
import ExperienceSelector from '../components/ExperienceSelector'
import WorkflowIcon from '../components/WorkflowIcon'
import { getAvatarUrl } from '../components/WorkflowLayout'
import { useAuth } from '../context/useAuth'
import { INTEREST_OPTIONS, LANGUAGE_OPTIONS } from '../data/profileOptions'
import '../styles/background.css'
import '../styles/components.css'
import '../styles/globals.css'
import '../styles/user-profile.css'

export default function UserProfilePage() {
  const { token, user, logout, updateUser } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<ContributorProfile | null>(null)
  const [languagesSelected, setLanguagesSelected] = useState<string[]>([])
  const [interestsSelected, setInterestsSelected] = useState<string[]>([])
  const [experience, setExperience] = useState<ContributorProfile['experience']>('beginner')
  const [nameValue, setNameValue] = useState(user?.name ?? '')
  const [emailValue, setEmailValue] = useState(user?.email ?? '')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => user ? getAvatarUrl(user.id) : null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
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
      })
      .catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'Unable to load your profile.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [attempt])

  if (!token) return <Navigate to="/login" replace />

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      localStorage.setItem(`avatar-${user.id}`, dataUrl)
      window.dispatchEvent(new StorageEvent('storage', { key: `avatar-${user.id}`, newValue: dataUrl }))
      setAvatarUrl(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const [accountResult] = await Promise.all([
        updateCurrentUser({ name: nameValue.trim() || undefined, email: emailValue.trim() || undefined }),
        updateProfile({ languages: languagesSelected, interests: interestsSelected, experience }),
      ])
      updateUser(accountResult)
      setSaved(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save your profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="up-page">
      <header className="up-header">
        <Link className="up-brand" to="/dashboard">
          <WorkflowIcon name="cube" />
          <span>ContribIQ</span>
        </Link>
        <div className="up-header-right">
          <span className="up-user-name">{user?.name}</span>
          <button className="btn btn-s" onClick={logout}>Sign out</button>
        </div>
      </header>

      <main className="up-main">
        <div className="up-card">
          <div className="up-card-header">
            <div className="up-avatar-row">
              <div className="up-avatar-wrap">
                <Avatar name={user?.name ?? ''} avatarUrl={avatarUrl} size={72} />
                <button
                  className="up-avatar-edit"
                  type="button"
                  title="Change profile picture"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                    <path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354l-1.086-1.086zM11.189 6.25 9.75 4.81l-6.286 6.287a.25.25 0 0 0-.064.108l-.558 1.953 1.953-.558a.249.249 0 0 0 .108-.064z"/>
                  </svg>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleAvatarChange}
                />
              </div>
              <div>
                <h1 className="up-title">{user?.name}</h1>
                <p className="up-desc">Update your skills, interests, and contribution preferences.</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="notice error" role="alert">
              {error}
              {!profile && (
                <button className="btn btn-s mt12" onClick={() => setAttempt(a => a + 1)}>Try again</button>
              )}
            </div>
          )}

          <fieldset className="up-fields" disabled={saving}>
            <section className="up-section">
              <h2 className="up-section-title">Account details</h2>
              <div className="up-account-fields">
                <label className="up-field-label">
                  Full name
                  <input
                    className="up-field-input"
                    type="text"
                    value={nameValue}
                    onChange={e => { setNameValue(e.target.value); setSaved(false) }}
                    placeholder="Your name"
                    autoComplete="name"
                  />
                </label>
                <label className="up-field-label">
                  Email address
                  <input
                    className="up-field-input"
                    type="email"
                    value={emailValue}
                    onChange={e => { setEmailValue(e.target.value); setSaved(false) }}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </label>
              </div>
            </section>

            <hr className="up-divider" />

            {loading ? (
              <p className="up-loading" role="status">Loading profile…</p>
            ) : profile && (
              <>
                <section className="up-section">
                  <h2 className="up-section-title">Which languages are you comfortable with?</h2>
                  <ChipSelector
                    label="Programming languages"
                    options={LANGUAGE_OPTIONS}
                    selected={languagesSelected}
                    onChange={v => { setLanguagesSelected(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]); setSaved(false) }}
                    allowCustom
                  />
                </section>

                <section className="up-section">
                  <h2 className="up-section-title">What's your open-source contribution experience?</h2>
                  <ExperienceSelector value={experience} onChange={v => { setExperience(v); setSaved(false) }} />
                </section>

                <section className="up-section">
                  <h2 className="up-section-title">What are you interested in working on?</h2>
                  <ChipSelector
                    label="Areas of interest"
                    options={INTEREST_OPTIONS}
                    selected={interestsSelected}
                    onChange={v => { setInterestsSelected(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]); setSaved(false) }}
                    allowCustom
                  />
                </section>
              </>
            )}

            {saved && <p className="notice success" role="status">Profile saved.</p>}

            <div className="up-actions">
              <button className="btn btn-s" onClick={() => navigate(-1)} type="button">← Back</button>
              <button
                className="btn btn-p"
                disabled={saving || (!profile && !loading)}
                onClick={() => void handleSave()}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </fieldset>
        </div>
      </main>
    </div>
  )
}
