import { apiCall } from './client'

export interface ContributorProfile {
  id: string
  user_id: string
  languages: string[]
  experience: 'beginner' | 'some' | 'experienced'
  interests: string[]
  created_at: string
  updated_at: string
}

export type ProfileUpdate = Partial<Pick<ContributorProfile, 'languages' | 'experience' | 'interests'>>

export interface PRCheck {
  name: string
  status: string
  conclusion: string | null
  url: string | null
}

export interface UserPR {
  number: number
  title: string
  url: string | null
  repo: string
  state: string
  merged_at: string | null
  draft: boolean
  created_at: string | null
  updated_at: string | null
  ci_status: 'success' | 'failure' | 'running' | 'pending'
  checks: PRCheck[]
}

export function getProfile(): Promise<ContributorProfile> {
  return apiCall<ContributorProfile>('/users/me/profile')
}

export function updateProfile(payload: ProfileUpdate): Promise<ContributorProfile> {
  return apiCall<ContributorProfile>('/users/me/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function getMyPRs(githubToken?: string | null, state: 'open' | 'closed' | 'all' = 'open'): Promise<UserPR[]> {  const params = new URLSearchParams({ state })
  if (githubToken) params.set('github_token', githubToken)
  return apiCall<UserPR[]>(`/users/me/prs?${params.toString()}`)
}

export interface BadgeSyncItem {
  badge_id: string
  earned: boolean
  count?: number | null
}

export interface StoredBadge {
  badge_id: string
  earned: boolean
  count: number | null
  earned_at: string | null
}

export function syncBadges(badges: BadgeSyncItem[]): Promise<{ synced: number }> {
  return apiCall<{ synced: number }>('/users/me/badges/sync', {
    method: 'POST',
    body: JSON.stringify(badges),
  })
}

export function getBadges(): Promise<StoredBadge[]> {
  return apiCall<StoredBadge[]>('/users/me/badges')
}
