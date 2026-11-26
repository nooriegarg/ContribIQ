import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { getGitHubLinkUrl, updateCurrentUser } from '../api/auth'
import { getProfile, getMyPRs, updateProfile, type ContributorProfile, type UserPR } from '../api/profile'
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

interface PRBadgeDef {
  id: string
  emoji: string
  label: string
  desc: string
  earned: boolean
  count?: number
}

const BADGE_BASE = 'https://github.com/nooriegarg/ContribIQ/releases/download/v0.1-assets'

const BADGE_IMAGES: Record<string, string> = {
  first_merge:       `${BADGE_BASE}/first_pr.png`,
  merged_10:         `${BADGE_BASE}/10_merged.png`,
  merged_50:         `${BADGE_BASE}/50_merged.png`,
  merged_100:        `${BADGE_BASE}/100_merged.png`,
  prolific:          `${BADGE_BASE}/prolific.png`,
  quick_ship:        `${BADGE_BASE}/quick_ship.png`,
  same_day:          `${BADGE_BASE}/same_day.png`,
  hotfix_hero:       `${BADGE_BASE}/hotfix_hero.png`,
  green_light:       `${BADGE_BASE}/green_light.png`,
  clean_streak:      `${BADGE_BASE}/clean_streak.png`,
  no_flakes:         `${BADGE_BASE}/no_flakes.png`,
  multi_repo:        `${BADGE_BASE}/multi_repo_contributor.png`,
  first_time:        `${BADGE_BASE}/first_time_contributor.png`,
  comeback:          `${BADGE_BASE}/comeback.png`,
  issue_hunter:      `${BADGE_BASE}/issue_hunter.png`,
  recommended_merge: `${BADGE_BASE}/recommended_merge.png`,
}

function BadgeIcon({ id, size = 24, label = '' }: { id: string; size?: number; label?: string }) {
  const src = BADGE_IMAGES[id]
  if (!src) return <span style={{ fontSize: size * 0.7, lineHeight: 1 }}>🏆</span>
  return <img src={src} alt={label} width={size} height={size} style={{ objectFit: 'contain', display: 'block' }} />
}

function computeBadges(merged: UserPR[]): PRBadgeDef[] {
  const n = merged.length

  // counts
  const repoCounts: Record<string, number> = {}
  for (const pr of merged) repoCounts[pr.repo] = (repoCounts[pr.repo] ?? 0) + 1
  const repoCount = Object.keys(repoCounts).length
  const prolific = Object.values(repoCounts).some(c => c >= 5)
  const greenCount = merged.filter(pr => pr.ci_status === 'success').length

  // speed
  const quickShip = merged.some(pr => {
    if (!pr.created_at || !pr.merged_at) return false
    return (new Date(pr.merged_at).getTime() - new Date(pr.created_at).getTime()) / 3_600_000 <= 24
  })
  const sameDay = merged.some(pr => {
    if (!pr.created_at || !pr.merged_at) return false
    return new Date(pr.created_at).toDateString() === new Date(pr.merged_at).toDateString()
  })
  const hotfixHero = merged.some(pr => {
    if (!pr.created_at || !pr.merged_at) return false
    return (new Date(pr.merged_at).getTime() - new Date(pr.created_at).getTime()) / 3_600_000 <= 1
  })

  // CI streak: 5 consecutive no-failure merges (sorted by merged_at)
  const sorted = [...merged].filter(pr => pr.merged_at).sort((a, b) =>
    new Date(a.merged_at!).getTime() - new Date(b.merged_at!).getTime()
  )
  let streak = 0, maxStreak = 0
  for (const pr of sorted) {
    if (pr.ci_status !== 'failure') { streak++; maxStreak = Math.max(maxStreak, streak) }
    else streak = 0
  }
  const cleanStreak = maxStreak >= 5
  const noFlakes = merged.length > 0 && merged.every(pr => pr.ci_status !== 'failure')

  // dates for comeback: gap of 30+ days between consecutive merged PRs
  const mergedDates = sorted.map(pr => new Date(pr.merged_at!).getTime())
  const comeback = mergedDates.some((t, i) =>
    i > 0 && (t - mergedDates[i - 1]) / 86_400_000 >= 30
  )

  return [
    // Activity volume
    { id: 'first_merge',  emoji: '🎉', label: 'First Merge',    desc: 'First PR merged anywhere.',              earned: n >= 1 },
    { id: 'merged_10',    emoji: '🔟', label: '10 Merged',      desc: '10 PRs merged.',                         earned: n >= 10,  count: n >= 10 ? Math.floor(n / 10) : undefined },
    { id: 'merged_50',    emoji: '🏅', label: '50 Merged',      desc: '50 PRs merged.',                         earned: n >= 50 },
    { id: 'merged_100',   emoji: '💯', label: '100 Merged',     desc: '100 PRs merged.',                        earned: n >= 100 },
    { id: 'prolific',     emoji: '📈', label: 'Prolific',       desc: '5+ PRs merged in a single repository.',  earned: prolific },
    // Speed
    { id: 'quick_ship',   emoji: '⚡', label: 'Quick Ship',     desc: 'PR merged within 24 hours of opening.',  earned: quickShip },
    { id: 'same_day',     emoji: '📅', label: 'Same Day',       desc: 'PR opened and merged on the same calendar day.', earned: sameDay },
    { id: 'hotfix_hero',  emoji: '🚨', label: 'Hotfix Hero',    desc: 'PR merged within 1 hour of opening.',    earned: hotfixHero },
    // CI quality
    { id: 'green_light',  emoji: '🟢', label: 'Green Light',   desc: '10 PRs merged with all checks passing.', earned: greenCount >= 10, count: greenCount >= 10 ? Math.floor(greenCount / 10) : undefined },
    { id: 'clean_streak', emoji: '🔥', label: 'Clean Streak',  desc: '5 consecutive PRs merged with no CI failures.', earned: cleanStreak },
    { id: 'no_flakes',    emoji: '❄️', label: 'No Flakes',     desc: 'Never had a failing check on a merged PR.', earned: noFlakes },
    // Depth
    { id: 'multi_repo',   emoji: '🗂️', label: 'Multi-Repo',    desc: 'Merged PRs into 3+ different repositories.', earned: repoCount >= 3 },
    { id: 'first_time',   emoji: '🌟', label: 'First-Timer',   desc: 'Merged a first PR into a repo you hadn\'t contributed to before.', earned: repoCount >= 1 },
    { id: 'comeback',     emoji: '🔁', label: 'Comeback',      desc: 'Merged a PR after 30+ days of inactivity.', earned: comeback },
    // ContribIQ
    { id: 'issue_hunter', emoji: '🔍', label: 'Issue Hunter',  desc: 'Completed the full ContribIQ workflow end-to-end.', earned: false },
    { id: 'recommended_merge', emoji: '✅', label: 'Recommended', desc: 'Merged a PR on an issue ContribIQ recommended.', earned: false },
  ]
}

function shareOnTwitter(badge: PRBadgeDef) {
  const text = encodeURIComponent(
    `🎉 Just earned the "${badge.label}" badge on ContribIQ!\n${badge.desc}\n\n#OpenSource #GitHub #ContribIQ`
  )
  window.open(`https://twitter.com/intent/tweet?text=${text}`, '_blank', 'noopener,noreferrer')
}

function shareOnLinkedIn(badge: PRBadgeDef) {
  const text = encodeURIComponent(
    `🎉 Just earned the "${badge.label}" badge on ContribIQ!\n\n${badge.desc}\n\n#OpenSource #GitHub #ContribIQ`
  )
  window.open(`https://www.linkedin.com/feed/?shareActive=true&text=${text}`, '_blank', 'noopener,noreferrer')
}

export default function UserProfilePage() {
  const { token, user, logout, updateUser } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'profile'>('profile')
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
  const [badges, setBadges] = useState<PRBadgeDef[]>(() => computeBadges([]))
  const [prsLoading, setPrsLoading] = useState(false)
  const [selectedBadge, setSelectedBadge] = useState<PRBadgeDef | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const location = useLocation()

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

  useEffect(() => {
    if (!user?.github_username) return
    let active = true
    setPrsLoading(true)
    const githubToken = localStorage.getItem('github_token')
    getMyPRs(githubToken, 'all')
      .then(data => {
        if (!active) return
        const merged = data.filter(pr => pr.merged_at !== null)
        const computed = computeBadges(merged)
        setBadges(computed)
      })
      .catch(() => {})
      .finally(() => { if (active) setPrsLoading(false) })
    return () => { active = false }
  }, [user?.github_username])

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
        <div className="up-card up-card-layout">

          {/* Left sidebar */}
          <aside className="up-sidebar">
            <div className="up-sidebar-avatar">
              <div className="up-avatar-wrap">
                <Avatar name={user?.name ?? ''} avatarUrl={avatarUrl} size={80} />
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
              <h1 className="up-sidebar-name">{user?.name}</h1>
              {user?.github_username && (
                <p className="up-sidebar-username">@{user.github_username}</p>
              )}
            </div>

            {prsLoading ? (
              <div className="up-sidebar-section">
                <h2 className="up-sidebar-section-title">Achievements</h2>
                <p className="up-sidebar-empty">Loading badges…</p>
              </div>
            ) : !user?.github_username ? (
              <div className="up-sidebar-section">
                <h2 className="up-sidebar-section-title">Achievements</h2>
                <p className="up-sidebar-empty">GitHub not connected</p>
                <a className="up-sidebar-gh-link" href={getGitHubLinkUrl(location.pathname)}>Connect GitHub</a>
              </div>
            ) : badges.length === 0 ? (
              <div className="up-sidebar-section">
                <h2 className="up-sidebar-section-title">Achievements</h2>
                <p className="up-sidebar-empty">Connect GitHub to earn badges</p>
              </div>
            ) : (
              <>
                {/* Earned badges */}
                {badges.filter(b => b.earned).length > 0 && (
                  <div className="up-sidebar-section">
                    <h2 className="up-sidebar-section-title">Achievements</h2>
                    <div className="up-badges-grid">
                      {badges.filter(b => b.earned).map(b => (
                        <div
                          key={b.id}
                          className={`up-badge-item earned${selectedBadge?.id === b.id ? ' selected' : ''}`}
                          onClick={() => setSelectedBadge(b)}
                          tabIndex={0}
                          onKeyDown={e => e.key === 'Enter' && setSelectedBadge(b)}
                          aria-label={`${b.label}: ${b.desc}`}
                        >
                          <span className="up-badge-tooltip">{b.desc}</span>
                          <div className="up-badge-icon">
                            <BadgeIcon id={b.id} size={24} label={b.label} />
                            {b.count && b.count > 1 && (
                              <span className="up-badge-count">×{b.count}</span>
                            )}
                          </div>
                          <span className="up-badge-label">{b.label}</span>
                          <div className="up-badge-share-row">
                            <button className="up-badge-share-btn up-badge-share-tw" title="Share on X" onClick={e => { e.stopPropagation(); shareOnTwitter(b) }} type="button">𝕏</button>
                            <button className="up-badge-share-btn up-badge-share-li" title="Share on LinkedIn" onClick={e => { e.stopPropagation(); shareOnLinkedIn(b) }} type="button">in</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Locked badges */}
                {badges.filter(b => !b.earned).length > 0 && (
                  <div className="up-sidebar-section">
                    <h2 className="up-sidebar-section-title">Locked</h2>
                    <div className="up-badges-grid">
                      {badges.filter(b => !b.earned).map(b => (
                        <div
                          key={b.id}
                          className={`up-badge-item${selectedBadge?.id === b.id ? ' selected' : ''}`}
                          onClick={() => setSelectedBadge(b)}
                          onKeyDown={e => e.key === 'Enter' && setSelectedBadge(b)}
                          tabIndex={0}
                          aria-label={`${b.label}: ${b.desc} (not yet earned)`}
                        >
                          <span className="up-badge-tooltip">{b.desc}</span>
                          <div className="up-badge-icon">
                            <BadgeIcon id={b.id} size={24} label={b.label} />
                          </div>
                          <span className="up-badge-label">{b.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hover modal shared across both sections */}
                {selectedBadge && (
                  <>
                    <div className="up-badge-modal-backdrop" onClick={() => setSelectedBadge(null)} />
                    <div
                      className="up-badge-modal"
                      role="dialog"
                      aria-modal="true"
                      aria-label={selectedBadge.label}
                    >
                      <button
                        className="up-badge-modal-close"
                        onClick={() => setSelectedBadge(null)}
                        aria-label="Close"
                        type="button"
                      >×</button>
                      <div className="up-badge-modal-banner">
                        <BadgeIcon id={selectedBadge.id} size={80} label={selectedBadge.label} />
                      </div>
                      <div className="up-badge-modal-body">
                        <div className="up-badge-modal-title-row">
                          <span className="up-badge-modal-name">{selectedBadge.label}</span>
                          {selectedBadge.earned && selectedBadge.count && selectedBadge.count > 1 && (
                            <span className="up-badge-modal-count">×{selectedBadge.count}</span>
                          )}
                          {!selectedBadge.earned && (
                            <span className="up-badge-modal-locked-pill">Locked</span>
                          )}
                        </div>
                        <p className="up-badge-modal-desc">{selectedBadge.desc}</p>
                        {selectedBadge.earned && (
                          <div className="up-badge-modal-share-row">
                            <button className="up-badge-modal-share-btn up-badge-modal-share-tw" onClick={() => shareOnTwitter(selectedBadge)} type="button">Share on 𝕏</button>
                            <button className="up-badge-modal-share-btn up-badge-modal-share-li" onClick={() => shareOnLinkedIn(selectedBadge)} type="button">Share on LinkedIn</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </aside>

          {/* Right main content */}
          <div className="up-main-content">
            <div className="up-card-header">
              <div>
                <h1 className="up-title">Profile</h1>
                <p className="up-desc">Update your skills, interests, and contribution preferences.</p>
              </div>
            </div>

            <div className="up-tabs">
              <button className={`up-tab${activeTab === 'profile' ? ' active' : ''}`} onClick={() => setActiveTab('profile')}>Profile</button>
            </div>

            {activeTab === 'profile' && (
              <>
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
              </>
            )}
          </div>

        </div>
      </main>
    </div>
  )
}
