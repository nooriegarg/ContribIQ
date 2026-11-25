import mermaid from 'mermaid'
import { useEffect, useRef, useState } from 'react'
import { apiCall } from '../api/client'
import WorkflowIcon from './WorkflowIcon'

interface ArchDiagramProps {
  taskId: string
  repoName: string
}

export default function ArchDiagram({ taskId, repoName }: ArchDiagramProps) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const wrapRef       = useRef<HTMLDivElement>(null)
  const [diagramTaskId, setDiagramTaskId] = useState<string | null>(null)
  const [syntax, setSyntax]               = useState<string | null>(null)
  const [status, setStatus]               = useState<'idle' | 'generating' | 'done' | 'error'>('idle')
  const [error, setError]                 = useState('')
  const [sourceFiles, setSourceFiles]     = useState<string[]>([])
  const [retryCount, setRetryCount]       = useState(0)
  const [zoom, setZoom]                   = useState(1)
  // natural SVG pixel width read from its viewBox, used to compute rendered size
  const naturalWidthRef = useRef<number>(0)
  const requestRef = useRef<{ taskId: string; promise: Promise<{ diagram_task_id: string }> } | null>(null)

  // ── fetch diagram task id ────────────────────────────────────────────────
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
      .then(({ diagram_task_id }) => { if (active) setDiagramTaskId(diagram_task_id) })
      .catch(reason => {
        if (!active) return
        setError(reason instanceof Error ? reason.message : 'Could not generate diagram.')
        setStatus('error')
      })
    return () => { active = false }
  }, [taskId, retryCount])

  // ── poll for completion ──────────────────────────────────────────────────
  useEffect(() => {
    if (!diagramTaskId || status !== 'generating') return

    let active = true
    const timeout = setTimeout(() => {
      active = false
      clearInterval(poll)
      setError('Diagram generation timed out. Check that the worker and Ollama model are running.')
      setStatus('error')
    }, 240000)
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

  // ── render SVG ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!syntax || !containerRef.current) return

    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      securityLevel: 'antiscript',
      flowchart: { curve: 'basis', useMaxWidth: true },
      themeVariables: {
        primaryColor: '#dbeafe',
        primaryTextColor: '#172554',
        primaryBorderColor: '#2563eb',
        lineColor: '#94a3b8',
        secondaryColor: '#f1f5f9',
        tertiaryColor: '#f8fafc',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        clusterBkg: '#f8fafc',
        clusterBorder: '#cbd5e1',
      },
    })
    mermaid
      .render(`arch-${repoName.replace(/\W/g, '-')}-${retryCount}`, syntax)
      .then(({ svg }) => {
        if (!containerRef.current) return
        containerRef.current.innerHTML = svg
        const svgEl = containerRef.current.querySelector('svg')
        if (svgEl) {
          // Read natural width from viewBox so we can scale absolutely
          const vb = svgEl.getAttribute('viewBox')
          naturalWidthRef.current = vb ? parseFloat(vb.split(' ')[2]) : svgEl.getBoundingClientRect().width || 800
          svgEl.removeAttribute('width')
          svgEl.removeAttribute('height')
          svgEl.style.display = 'block'
          svgEl.style.width = '100%'
          svgEl.style.height = 'auto'
        }
        setZoom(1)
      })
      .catch(reason => {
        setError(reason instanceof Error ? reason.message : 'The generated diagram could not be rendered.')
        setStatus('error')
      })
  }, [syntax, repoName, retryCount])

  // ── apply zoom by resizing the wrapper (not CSS transform) ───────────────
  // At zoom=1 the wrapper fills its parent (the card); at other values it
  // expands/shrinks in absolute px so the card reflows around it.
  useEffect(() => {
    if (!wrapRef.current) return
    if (zoom === 1) {
      wrapRef.current.style.width = '100%'
    } else if (naturalWidthRef.current > 0) {
      wrapRef.current.style.width = `${Math.round(naturalWidthRef.current * zoom)}px`
    }
  }, [zoom])

  const handleRetry = () => {
    sessionStorage.removeItem(`arch-${taskId}`)
    setRetryCount(c => c + 1)
  }

  const zoomIn    = () => setZoom(z => Math.min(+(z + 0.25).toFixed(2), 3))
  const zoomOut   = () => setZoom(z => Math.max(+(z - 0.25).toFixed(2), 0.25))
  const zoomReset = () => setZoom(1)

  return (
    <section className="card" style={{ gridColumn: 'span 2' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <h2 className="ctitle" style={{ margin: 0 }}>
          <span className="ctitle-icon"><WorkflowIcon name="stack" /></span>
          Application Architecture
        </h2>
        {status === 'done' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={zoomOut} title="Zoom out" style={btnStyle} disabled={zoom <= 0.25}>−</button>
            <span style={{ fontSize: 12, color: 'var(--muted)', minWidth: 36, textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </span>
            <button onClick={zoomIn} title="Zoom in" style={btnStyle} disabled={zoom >= 3}>+</button>
            <button onClick={zoomReset} title="Reset to fit" style={{ ...btnStyle, fontSize: 11, padding: '3px 8px', width: 'auto' }}>Fit</button>
          </div>
        )}
      </div>

      {status === 'generating' && (
        <p className="muted" role="status">Reading repository source and generating application architecture...</p>
      )}
      {status === 'error' && (
        (error.toLowerCase().includes('library') || error.toLowerCase().includes('not enough')) ? (
          <div className="notice" role="status">
            <p>This is a framework or library repo — architecture diagrams apply to applications <em>built with</em> {repoName.split('/')[1] ?? repoName}, not the framework itself.</p>
          </div>
        ) : (
          <div className="notice error" role="alert">
            <p>{error}</p>
            <button className="btn btn-s mt12" onClick={handleRetry}>Try again</button>
          </div>
        )
      )}

      {/* Outer scroll container — only scrolls when zoomed in beyond card width */}
      <div style={{ overflow: 'auto', borderRadius: 6, display: 'flex', justifyContent: 'center' }}>
        {/* wrapRef grows/shrinks with zoom; the SVG inside fills it via width:100% */}
        <div
          ref={wrapRef}
          style={{ width: '100%', transition: 'width 0.15s ease', flexShrink: 0 }}
        >
          <div ref={containerRef} />
        </div>
      </div>

      {status === 'done' && sourceFiles.length > 0 && (
        <p className="muted mt12">
          Inferred from {sourceFiles.join(', ')}. Shows application components and connections, not a verified runtime trace.
        </p>
      )}
    </section>
  )
}

const btnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--surface, #f6f8fa)',
  border: '1px solid var(--border, #d0d7de)',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 16,
  lineHeight: 1,
  color: 'var(--black)',
  padding: 0,
}
