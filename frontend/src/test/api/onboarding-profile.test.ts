import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockApiCall = vi.fn()
vi.mock('../../api/client', () => ({ apiCall: mockApiCall }))

describe('onboarding API', () => {
  beforeEach(() => mockApiCall.mockReset())

  it('calls the correct endpoint', async () => {
    const plan = { steps: [], estimated_minutes: 30, issue_preview: { title: 't', number: 1 } }
    mockApiCall.mockResolvedValueOnce(plan)
    const { getOnboardingPlan } = await import('../../api/onboarding')
    const result = await getOnboardingPlan('task-99')
    expect(result).toEqual(plan)
    expect(mockApiCall).toHaveBeenCalledWith('/analysis/result/task-99/onboarding')
  })
})

describe('profile API', () => {
  beforeEach(() => mockApiCall.mockReset())

  it('getProfile calls correct endpoint', async () => {
    const profile = { id: '1', user_id: 'u1', languages: ['Python'], experience: 'beginner', interests: [], created_at: '', updated_at: '' }
    mockApiCall.mockResolvedValueOnce(profile)
    const { getProfile } = await import('../../api/profile')
    const result = await getProfile()
    expect(result).toEqual(profile)
    expect(mockApiCall).toHaveBeenCalledWith('/users/me/profile')
  })

  it('updateProfile calls PUT with payload', async () => {
    const updated = { id: '1', user_id: 'u1', languages: ['Go'], experience: 'experienced', interests: [], created_at: '', updated_at: '' }
    mockApiCall.mockResolvedValueOnce(updated)
    const { updateProfile } = await import('../../api/profile')
    const result = await updateProfile({ languages: ['Go'], experience: 'experienced' })
    expect(result.languages).toEqual(['Go'])
    expect(mockApiCall).toHaveBeenCalledWith('/users/me/profile', expect.objectContaining({ method: 'PUT' }))
  })
})
