import { apiCall } from './client'

export interface AnalysisRequest {
  owner: string
  repo: string
  github_token?: string
}

export interface AnalysisResult {
  owner: string
  repo: string
  status: string
  metadata: {
    stars: number
    forks: number
    open_issues: number
    language: string | null
    topics: string[]
    description: string | null
    full_name: string
  }
  tech_stack: string[]
  directory_map: { directory: string; description: string }[]
  test_file_count?: number
  test_coverage_pct?: number
  issues?: RepositoryIssue[]
  steps?: ProgressEvent[]
}

export interface RepositoryIssue {
  number: number
  title: string
  body: string | null
  state: string
  labels: { name: string }[]
  html_url: string
  user?: { login: string }
  created_at?: string
  pull_request?: { url: string }
}

export interface ProgressEvent {
  step: string
  status: string
  data?: Record<string, unknown>
}

export async function startAnalysis(req: AnalysisRequest): Promise<{ task_id: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(
    new Error('Submitting analysis timed out. Check that the API and Valkey are running, then try again.'),
  ), 15000)
  const githubToken = localStorage.getItem('github_token')
  try {
    return await apiCall<{ task_id: string }>('/analysis/start', {
      method: 'POST',
      body: JSON.stringify({ ...req, github_token: githubToken ?? undefined }),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

export interface IssueMatch {
  issue_number: number
  match_pct: number
  reasons: string[]
}

export async function getMatchedIssues(taskId: string): Promise<IssueMatch[]> {
  return apiCall<IssueMatch[]>(`/analysis/result/${taskId}/matches`)
}

export async function getAnalysisResult(taskId: string): Promise<AnalysisResult> {
  return apiCall<AnalysisResult>(`/analysis/result/${taskId}`)
}

export function subscribeToProgress(
  taskId: string,
  onProgress: (event: ProgressEvent) => void,
  onDone: (result: AnalysisResult) => void,
  onError: (error: string) => void,
): AbortController {
  const base = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
  const token = localStorage.getItem('token') ?? sessionStorage.getItem('token')
  const controller = new AbortController()

  async function readProgress() {
    try {
      const response = await fetch(`${base}/analysis/stream/${encodeURIComponent(taskId)}`, {
        headers: {
          Accept: 'text/event-stream',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: controller.signal,
      })
      if (!response.ok) {
        throw new Error(response.status === 401
          ? 'Your session has expired. Please sign in again.'
          : `Unable to read analysis progress (HTTP ${response.status}).`)
      }
      if (!response.body) throw new Error('Analysis progress stream is unavailable.')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      try {
        while (!controller.signal.aborted) {
          const { value, done } = await reader.read()
          buffer += decoder.decode(value, { stream: !done })
          buffer = buffer.replace(/\r\n/g, '\n')
          let boundary: number
          while ((boundary = buffer.indexOf('\n\n')) !== -1) {
            const frame = buffer.slice(0, boundary)
            buffer = buffer.slice(boundary + 2)
            const lines = frame.split('\n')
            const event = lines.find(line => line.startsWith('event:'))?.slice(6).trim()
            const data = lines.filter(line => line.startsWith('data:'))
              .map(line => line.slice(5).trimStart()).join('\n')
            if (!data) continue
            if (event === 'progress') onProgress(JSON.parse(data) as ProgressEvent)
            if (event === 'done') {
              const result = JSON.parse(data) as AnalysisResult
              if (result.status !== 'completed') throw new Error('Repository analysis failed.')
              onDone(result)
              return
            }
            if (event === 'error') {
              const error = JSON.parse(data) as { error?: string }
              throw new Error(error.error || 'Analysis failed.')
            }
            if (event === 'timeout') throw new Error('Analysis timed out. Check that the background worker is running, then try again.')
          }
          if (done) throw new Error('Analysis connection closed before completion. Please try again.')
        }
      } finally {
        await reader.cancel()
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        onError(error instanceof Error ? error.message : 'Analysis failed.')
      }
    }
  }

  void readProgress()
  return controller
}

export interface IssueDetail {
  number: number
  title: string
  body: string | null
  url: string | null
  labels: string[]
  difficulty: number
  difficulty_factors: Record<string, number>
  explanation: string
  files_affected: { path: string; role: string }[]
  prerequisites: { title: string; description: string }[]
  impact_chain: string[]
  implementation_steps: string[]
  similar_prs: { number: number; title: string; url: string | null }[]
  checklist: { step: string }[]
}

export async function getIssueDetail(
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<IssueDetail> {
  return apiCall<IssueDetail>(
    `/issues/${issueNumber}/detail?owner=${encodeURIComponent(owner)}&repo=${encodeURIComponent(repo)}`,
  )
}

export interface ReadinessResult {
  overall: number
  dimensions: { key: string; label: string; score: number; weight: number }[]
}

export async function getReadinessScore(taskId: string, issueNumber: number): Promise<ReadinessResult> {
  return apiCall<ReadinessResult>(`/analysis/result/${taskId}/readiness/${issueNumber}`)
}

export interface GeneratedIssue {
  title: string
  description: string
  files_affected: string[]
  skills: string[]
  difficulty: number
  estimated_hours: number
  why_beginner_friendly: string
  gap_kind: 'todo' | 'untested' | 'missing_docstring'
  source: 'ai_generated'
}

export async function getGeneratedIssues(taskId: string): Promise<GeneratedIssue[]> {
  return apiCall<GeneratedIssue[]>(`/analysis/result/${taskId}/generated-issues`)
}
