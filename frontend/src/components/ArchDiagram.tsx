import mermaid from 'mermaid'
import { useEffect, useRef, useState } from 'react'
import { apiCall } from '../api/client'
import WorkflowIcon from './WorkflowIcon'

interface ArchDiagramProps {
  taskId: string
  repoName: string
}

export default function ArchDiagram({ taskId, repoName }: ArchDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [diagramTaskId, setDiagramTaskId] = useState<string | null>(null)
  const [syntax, setSyntax] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'generating' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const [sourceFiles, setSourceFiles] = useState<string[]>([])
  const [retryCount, setRetryCount] = useState(0)
  const requestRef = useRef<{ taskId: string; promise: Promise<{ diagram_task_id: string }> } | null>(null)

  useEffect(() => {
    const cacheKey = `arch-${taskId}`
    const cached = sessionStorage.getItem(cacheKey)
    if (cached && retryCount === 0) {
      const { syntax: s, sourceFiles: sf } = JSON.parse(cached)
      setSyntax(s)
      setSourceFiles(sf)
      setStatus('done')
      return
    }

    let active = true
    setStatus('generating')
    setError('')
    setSyntax(null)
    setSourceFiles([])
    setDiagramTaskId(null)
    requestRef.current = {
      taskId,
      promise: apiCall<{ diagram_task_id: string }>(`/analysis/${taskId}/diagram`, { method: 'POST' }),
    }
    requestRef.current.promise
      .then(({ diagram_task_id }) => {
        if (!active) return
        setDiagramTaskId(diagram_task_id)
      })
      .catch(reason => {
        if (!active) return
        setError(reason instanceof Error ? reason.message : 'Could not generate diagram.')
        setStatus('error')
      })
    return () => { active = false }
  }, [taskId, retryCount])

  useEffect(() => {
    if (!diagramTaskId || status !== 'generating') return

    let active = true
    const timeout = setTimeout(() => {
      active = false
      clearInterval(poll)
      setError('Diagram generation timed out. Check that the worker and Ollama model are running.')
      setStatus('error')
    }, 120000)
    const poll = setInterval(() => {
      apiCall<{ mermaid_syntax: string; status: string; source_files?: string[] }>(`/analysis/diagram/${diagramTaskId}`)
        .then(({ mermaid_syntax, status, source_files }) => {
          if (!active) return
          if (status === 'completed' && mermaid_syntax) {
            clearInterval(poll)
            clearTimeout(timeout)
            active = false
            sessionStorage.setItem(`arch-${taskId}`, JSON.stringify({ syntax: mermaid_syntax, sourceFiles: source_files ?? [] }))
            setSyntax(mermaid_syntax)
            setSourceFiles(source_files ?? [])
            setStatus('done')
          }
        })
        .catch(reason => {
          if (!active) return
          active = false
          clearInterval(poll)
          clearTimeout(timeout)
          setError(reason instanceof Error ? reason.message : 'Could not generate diagram.')
          setStatus('error')
        })
    }, 2000)

    return () => { active = false; clearInterval(poll); clearTimeout(timeout) }
  }, [diagramTaskId, status])

  useEffect(() => {
    if (!syntax || !containerRef.current) return

    mermaid.initialize({
      startOnLoad: false, theme: 'base', securityLevel: 'strict',
      themeVariables: { primaryColor: '#D1EFFF', primaryTextColor: '#002A86', primaryBorderColor: '#1B90FF', lineColor: '#89D1FF', fontFamily: 'system-ui, sans-serif' },
    })
    mermaid
      .render(`arch-${repoName.replace(/\W/g, '-')}-${retryCount}`, syntax)
      .then(({ svg }) => {
        if (containerRef.current) {
          containerRef.current.innerHTML = svg
          const svgEl = containerRef.current.querySelector('svg')
          if (svgEl) {
            const viewBox = svgEl.getAttribute('viewBox')
            const naturalWidth = viewBox ? parseFloat(viewBox.split(' ')[2]) : null
            svgEl.removeAttribute('width')
            svgEl.removeAttribute('height')
            svgEl.style.width = '100%'
            svgEl.style.height = 'auto'
            svgEl.style.display = 'block'
            if (naturalWidth) svgEl.style.maxWidth = `${naturalWidth}px`
          }
        }
      })
      .catch(reason => {
        setError(reason instanceof Error ? reason.message : 'The generated diagram could not be rendered.')
        setStatus('error')
      })
  }, [syntax, repoName, retryCount])

  const handleRetry = () => {
    sessionStorage.removeItem(`arch-${taskId}`)
    setRetryCount(c => c + 1)
  }

  return (
    <section className="card" style={{ gridColumn: 'span 2' }}>
      <h2 className="ctitle">
        <span className="ctitle-icon"><WorkflowIcon name="stack" /></span>
        Application Architecture
      </h2>
      {status === 'generating' && <p className="muted" role="status">Reading repository source and generating application architecture...</p>}
      {status === 'error' && (
        <div className="notice error" role="alert">
          <p>{error}</p>
          <button className="btn btn-s mt12" onClick={handleRetry}>Try again</button>
        </div>
      )}
      <div className="arch-wrap" ref={containerRef} />
      {status === 'done' && sourceFiles.length > 0 && <p className="muted mt12">Inferred from {sourceFiles.join(', ')}. Shows application components and connections, not a verified runtime trace.</p>}
    </section>
  )
}
