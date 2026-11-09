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
}

export interface ProgressEvent {
  step: string
  status: string
  data?: Record<string, unknown>
}

export async function startAnalysis(req: AnalysisRequest): Promise<{ task_id: string }> {
  return apiCall<{ task_id: string }>('/analysis/start', {
    method: 'POST',
    body: JSON.stringify(req),
  })
}

export async function getAnalysisResult(taskId: string): Promise<AnalysisResult> {
  return apiCall<AnalysisResult>(`/analysis/result/${taskId}`)
}

export function subscribeToProgress(
  taskId: string,
  onProgress: (event: ProgressEvent) => void,
  onDone: (result: AnalysisResult) => void,
  onError: (error: string) => void,
): EventSource {
  const base = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
  const token = localStorage.getItem('token') ?? sessionStorage.getItem('token')
  const url = `${base}/analysis/stream/${taskId}${token ? `?token=${token}` : ''}`

  const es = new EventSource(url)

  es.addEventListener('progress', (e) => {
    onProgress(JSON.parse(e.data) as ProgressEvent)
  })

  es.addEventListener('done', (e) => {
    es.close()
    onDone(JSON.parse(e.data) as AnalysisResult)
  })

  es.addEventListener('error', (e) => {
    es.close()
    const data = (e as MessageEvent).data
    onError(data ? (JSON.parse(data) as { error: string }).error : 'Analysis failed')
  })

  es.addEventListener('timeout', () => {
    es.close()
    onError('Analysis timed out')
  })

  return es
}
