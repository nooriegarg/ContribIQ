import { useCallback, useRef, useState } from 'react'
import {
  type AnalysisResult,
  type ProgressEvent,
  getAnalysisResult,
  startAnalysis,
  subscribeToProgress,
} from '../api/analyze'

type Status = 'idle' | 'starting' | 'running' | 'done' | 'error'

interface UseAnalysisState {
  status: Status
  taskId: string | null
  steps: ProgressEvent[]
  result: AnalysisResult | null
  error: string | null
}

interface UseAnalysisActions {
  run: (owner: string, repo: string, githubToken?: string) => Promise<void>
  resume: (taskId: string) => Promise<void>
  reset: () => void
}

export function useAnalysis(): UseAnalysisState & UseAnalysisActions {
  const [state, setState] = useState<UseAnalysisState>({
    status: 'idle',
    taskId: null,
    steps: [],
    result: null,
    error: null,
  })

  const esRef = useRef<EventSource | null>(null)

  const subscribe = useCallback((taskId: string) => {
    if (esRef.current) esRef.current.close()

    esRef.current = subscribeToProgress(
      taskId,
      (event) => {
        setState((prev) => ({ ...prev, status: 'running', steps: [...prev.steps, event] }))
      },
      (result) => {
        setState((prev) => ({ ...prev, status: 'done', result }))
      },
      (error) => {
        setState((prev) => ({ ...prev, status: 'error', error }))
      },
    )
  }, [])

  const run = useCallback(
    async (owner: string, repo: string, githubToken?: string) => {
      setState({ status: 'starting', taskId: null, steps: [], result: null, error: null })
      try {
        const { task_id } = await startAnalysis({ owner, repo, github_token: githubToken })
        setState((prev) => ({ ...prev, taskId: task_id }))
        subscribe(task_id)
      } catch (err) {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: err instanceof Error ? err.message : 'Failed to start analysis',
        }))
      }
    },
    [subscribe],
  )

  const resume = useCallback(
    async (taskId: string) => {
      setState({ status: 'running', taskId, steps: [], result: null, error: null })
      try {
        const result = await getAnalysisResult(taskId)
        if (result.status === 'completed') {
          setState((prev) => ({ ...prev, status: 'done', result }))
        } else {
          subscribe(taskId)
        }
      } catch {
        subscribe(taskId)
      }
    },
    [subscribe],
  )

  const reset = useCallback(() => {
    if (esRef.current) esRef.current.close()
    setState({ status: 'idle', taskId: null, steps: [], result: null, error: null })
  }, [])

  return { ...state, run, resume, reset }
}
