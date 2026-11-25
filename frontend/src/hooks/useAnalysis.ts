import { useCallback, useEffect, useRef, useState } from 'react'
import {
  type AnalysisResult,
  type ProgressEvent,
  getAnalysisResult,
  startAnalysis,
  subscribeToProgress,
} from '../api/analyze'
import { useAuth } from '../context/useAuth'

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

export interface RepoHistoryEntry {
  taskId: string
  fullName: string
  analyzedAt: string
}

const MAX_HISTORY = 10

function historyKey(userId: string) {
  return `contribiq_repo_history_${userId}`
}

export function getRepoHistory(userId?: string): RepoHistoryEntry[] {
  const key = userId ? historyKey(userId) : 'contribiq_repo_history'
  try {
    return JSON.parse(localStorage.getItem(key) ?? '[]') as RepoHistoryEntry[]
  } catch {
    return []
  }
}

export function removeFromHistory(taskId: string, userId?: string): RepoHistoryEntry[] {
  const key = userId ? historyKey(userId) : 'contribiq_repo_history'
  const updated = getRepoHistory(userId).filter(e => e.taskId !== taskId)
  localStorage.setItem(key, JSON.stringify(updated))
  return updated
}

function saveToHistory(taskId: string, result: AnalysisResult, userId?: string) {
  const key = userId ? historyKey(userId) : 'contribiq_repo_history'
  const fullName = result.metadata.full_name || `${result.owner}/${result.repo}`
  const entry: RepoHistoryEntry = { taskId, fullName, analyzedAt: new Date().toISOString() }
  const existing = getRepoHistory(userId).filter(e => e.taskId !== taskId)
  localStorage.setItem(key, JSON.stringify([entry, ...existing].slice(0, MAX_HISTORY)))
}

export function useAnalysis(): UseAnalysisState & UseAnalysisActions {
  const { user } = useAuth()
  const userId = user?.id

  const [state, setState] = useState<UseAnalysisState>({
    status: 'idle',
    taskId: null,
    steps: [],
    result: null,
    error: null,
  })

  const esRef = useRef<AbortController | null>(null)
  const generationRef = useRef(0)
  const taskIdRef = useRef<string | null>(null)

  useEffect(() => () => {
    generationRef.current++
    esRef.current?.abort()
  }, [])

  const subscribe = useCallback((taskId: string) => {
    esRef.current?.abort()
    const generation = generationRef.current

    esRef.current = subscribeToProgress(
      taskId,
      (event) => {
        if (generation !== generationRef.current) return
        setState((prev) => ({ ...prev, status: 'running', steps: [...prev.steps, event] }))
      },
      (result) => {
        if (generation !== generationRef.current) return
        if (taskIdRef.current) saveToHistory(taskIdRef.current, result, userId)
        setState((prev) => ({ ...prev, status: 'done', result }))
      },
      (error) => {
        if (generation !== generationRef.current) return
        setState((prev) => ({ ...prev, status: 'error', error }))
      },
    )
  }, [userId])

  const run = useCallback(
    async (owner: string, repo: string, githubToken?: string) => {
      const generation = ++generationRef.current
      esRef.current?.abort()
      taskIdRef.current = null
      setState({ status: 'starting', taskId: null, steps: [], result: null, error: null })
      try {
        const { task_id } = await startAnalysis({ owner, repo, github_token: githubToken })
        if (generation !== generationRef.current) return
        taskIdRef.current = task_id
        setState((prev) => ({ ...prev, status: 'running', taskId: task_id }))
        subscribe(task_id)
      } catch (err) {
        if (generation !== generationRef.current) return
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
      const generation = ++generationRef.current
      esRef.current?.abort()
      setState({ status: 'running', taskId, steps: [], result: null, error: null })
      try {
        const result = await getAnalysisResult(taskId)
        if (generation !== generationRef.current) return
        if (result.status === 'completed') {
          setState((prev) => ({ ...prev, status: 'done', result }))
        } else {
          subscribe(taskId)
        }
      } catch (error) {
        if (generation !== generationRef.current) return
        setState(prev => ({
          ...prev, status: 'error',
          error: error instanceof Error ? error.message : 'Unable to resume analysis.',
        }))
      }
    },
    [subscribe],
  )

  const reset = useCallback(() => {
    generationRef.current++
    esRef.current?.abort()
    setState({ status: 'idle', taskId: null, steps: [], result: null, error: null })
  }, [])

  return { ...state, run, resume, reset }
}
