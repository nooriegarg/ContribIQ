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

export function getProfile(): Promise<ContributorProfile> {
  return apiCall<ContributorProfile>('/users/me/profile')
}

export function updateProfile(payload: ProfileUpdate): Promise<ContributorProfile> {
  return apiCall<ContributorProfile>('/users/me/profile', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}
