import mermaid from 'mermaid'
import { useEffect, useRef, useState } from 'react'
import { apiCall } from '../api/client'

interface ArchDiagramProps {
  taskId: string
  techStack: string[]
  repoName: string
}

export default function ArchDiagram({ taskId, techStack, repoName }: ArchDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [diagramTaskId, setDiagramTaskId] = useState<string | null>(null)
  const [syntax, setSyntax] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'generating' | 'done' | 'error'>('idle')

  useEffect(() => {
    if (techStack.length === 0) return

    apiCall<{ diagram_task_id: string }>(`/analysis/${taskId}/diagram`, { method: 'POST' })
      .then(({ diagram_task_id }) => {
        setDiagramTaskId(diagram_task_id)
        setStatus('generating')
      })
      .catch(() => setStatus('error'))
  }, [taskId, techStack])

  useEffect(() => {
    if (!diagramTaskId || status !== 'generating') return

    const poll = setInterval(() => {
      apiCall<{ mermaid_syntax: string; status: string }>(`/analysis/diagram/${diagramTaskId}`)
        .then(({ mermaid_syntax, status }) => {
          if (status === 'completed' && mermaid_syntax) {
            clearInterval(poll)
            setSyntax(mermaid_syntax)
            setStatus('done')
          }
          // status === 'pending': keep polling
        })
        .catch(() => {
          clearInterval(poll)
          setStatus('error')
        })
    }, 2000)

    return () => clearInterval(poll)
  }, [diagramTaskId, status])

  useEffect(() => {
    if (!syntax || !containerRef.current) return

    mermaid.initialize({ startOnLoad: false, theme: 'dark' })
    mermaid
      .render(`arch-${repoName.replace(/\W/g, '-')}`, syntax)
      .then(({ svg }) => {
        if (containerRef.current) containerRef.current.innerHTML = svg
      })
      .catch(() => setStatus('error'))
  }, [syntax, repoName])

  if (techStack.length === 0) return null

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 'var(--r)',
      padding: '20px 24px',
      marginBottom: 16,
    }}>
      <h2 style={{ color: 'var(--white)', fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
        Architecture Diagram
      </h2>

      {status === 'generating' && (
        <div style={{ color: 'var(--gm)', fontSize: 13 }}>Generating diagram…</div>
      )}

      {status === 'error' && (
        <div style={{ color: 'var(--red)', fontSize: 13 }}>
          Could not generate diagram
        </div>
      )}

      <div ref={containerRef} style={{ overflowX: 'auto' }} />
    </div>
  )
}
