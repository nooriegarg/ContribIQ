import mermaid from 'mermaid'
import { useCallback, useEffect, useRef, useState } from 'react'
import { apiCall } from '../api/client'
import WorkflowIcon from './WorkflowIcon'

interface ArchDiagramProps {
  taskId: string
  repoName: string
}

export default function ArchDiagram({ taskId, repoName }: ArchDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const naturalRef = useRef({ w: 0, h: 0 })
  const [zoom, setZoom] = useState(1)
  const [dragging, setDragging] = useState(false)
  const [diagramTaskId, setDiagramTaskId] = useState<string | null>(null)
  const [syntax, setSyntax] = useState<string | null>(null)
  const [status, setStatus] = useState<'idle' | 'generating' | 'done' | 'error'>('idle')
  const [error, setError] = useState('')
  const [sourceFiles, setSourceFiles] = useState<string[]>([])
  const requestRef = useRef<{ taskId: string; promise: Promise<{ diagram_task_id: string }> } | null>(null)

  useEffect(() => {
    let active = true
    setStatus('generating')
    setError('')
    setSyntax(null)
    setSourceFiles([])
    setDiagramTaskId(null)
    if (requestRef.current?.taskId !== taskId) {
      requestRef.current = {
        taskId,
        promise: apiCall<{ diagram_task_id: string }>(`/analysis/${taskId}/diagram`, { method: 'POST' }),
      }
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
  }, [taskId])

  useEffect(() => {
    if (!diagramTaskId || status !== 'generating') return

    let active = true
    const timeout = setTimeout(() => {
      active = false
      clearInterval(poll)
      setError('Diagram generation timed out. Check that the background worker is running.')
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
      flowchart: { useMaxWidth: false, htmlLabels: true, nodeSpacing: 30, rankSpacing: 70, padding: 12 },
      themeVariables: { primaryColor: '#D1EFFF', primaryTextColor: '#002A86', primaryBorderColor: '#1B90FF', lineColor: '#89D1FF', fontFamily: 'system-ui, sans-serif', fontSize: '16px' },
    })
    mermaid
      .render(`arch-${repoName.replace(/\W/g, '-')}`, syntax)
      .then(({ svg }) => {
        if (!containerRef.current) return
        containerRef.current.innerHTML = svg
        const el = containerRef.current.querySelector('svg')
        const box = el?.viewBox.baseVal
        if (el && box && box.width) {
          naturalRef.current = { w: box.width, h: box.height }
          fitToWidth()
        }
      })
      .catch(reason => {
        setError(reason instanceof Error ? reason.message : 'The generated diagram could not be rendered.')
        setStatus('error')
      })
  }, [syntax, repoName])

  const fitToWidth = useCallback(() => {
    const viewport = viewportRef.current
    const { w } = naturalRef.current
    if (!viewport || !w) return
    setZoom(Math.min(Math.max((viewport.clientWidth - 24) / w, 0.2), 1.6))
    viewport.scrollTo({ top: 0, left: 0 })
  }, [])

  useEffect(() => {
    const el = containerRef.current?.querySelector('svg')
    const { w, h } = naturalRef.current
    if (!el || !w) return
    el.setAttribute('width', String(w * zoom))
    el.setAttribute('height', String(h * zoom))
  }, [zoom, syntax])

  const changeZoom = (factor: number) => setZoom(z => Math.min(Math.max(z * factor, 0.2), 4))

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      changeZoom(event.deltaY < 0 ? 1.1 : 1 / 1.1)
    }
    viewport.addEventListener('wheel', onWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', onWheel)
  }, [status])

  const startDrag = (event: React.MouseEvent<HTMLDivElement>) => {
    const viewport = viewportRef.current
    if (!viewport) return
    const start = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop }
    setDragging(true)
    const move = (e: MouseEvent) => {
      viewport.scrollLeft = start.left - (e.clientX - start.x)
      viewport.scrollTop = start.top - (e.clientY - start.y)
    }
    const stop = () => {
      setDragging(false)
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', stop)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', stop)
  }

  return (
    <section className="card mt16">
      <div className="arch-head">
        <h2 className="ctitle">
          <span className="ctitle-icon"><WorkflowIcon name="stack" /></span>
          Application Architecture
        </h2>
        {status === 'done' && (
          <div className="arch-controls" role="group" aria-label="Diagram zoom">
            <button type="button" onClick={() => changeZoom(1 / 1.25)} aria-label="Zoom out">−</button>
            <span aria-live="polite">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => changeZoom(1.25)} aria-label="Zoom in">+</button>
            <button type="button" onClick={fitToWidth}>Fit</button>
            <button type="button" onClick={() => setZoom(1)}>100%</button>
          </div>
        )}
      </div>
      {status === 'generating' && <p className="muted" role="status">Reading repository source and generating application architecture...</p>}
      {status === 'error' && <p className="notice error" role="alert">{error}</p>}
      <div className={`arch-viewport${dragging ? ' dragging' : ''}`} ref={viewportRef} onMouseDown={startDrag} hidden={status !== 'done'}>
        <div className="arch-wrap" ref={containerRef} />
      </div>
      {status === 'done' && sourceFiles.length > 0 && <p className="muted mt12">Inferred from {sourceFiles.join(', ')}. Shows application components and connections, not a verified runtime trace.</p>}
    </section>
  )
}
