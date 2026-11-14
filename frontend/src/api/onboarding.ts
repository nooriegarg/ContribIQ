import { apiCall } from './client'

export interface OnboardingStep {
  step: number
  title: string
  description: string
  commands: string[]
  files_to_read: { path: string; purpose: string }[]
}

export interface IssuePreview {
  number?: number
  title: string
  description?: string
  difficulty: number | string
  labels?: string[]
}

export interface OnboardingPlan {
  steps: OnboardingStep[]
  estimated_minutes: number
  issue_preview: IssuePreview
}

export function getOnboardingPlan(taskId: string): Promise<OnboardingPlan> {
  return apiCall<OnboardingPlan>(`/analysis/result/${encodeURIComponent(taskId)}/onboarding`)
}
