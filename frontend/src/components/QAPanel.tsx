import { useState } from 'react'
import { apiCall } from '../api/client'

interface QAResponse {
  answer: string
  sources: string[]
}

interface QAPanelProps {
  taskId: string
}

export default function QAPanel({ taskId }: QAPanelProps) {
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<QAResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!question.trim()) return

    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const data = await apiCall<QAResponse>('/qa/ask', {
        method: 'POST',
        body: JSON.stringify({ task_id: taskId, question: question.trim() }),
      })
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get answer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="card" style={{ gridColumn: '1 / -1' }}>
      <h2 className="ctitle">Ask About This Codebase</h2>

      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="e.g. How does authentication work?"
          disabled={loading}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: 'white',
            border: '1px solid #ccd4df',
            borderRadius: 6,
            color: 'var(--black)',
            fontSize: 13,
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="btn btn-p"
        >
          {loading ? 'Asking…' : 'Ask'}
        </button>
      </form>

      {error && (
        <p className="notice" style={{ color: '#f85149', marginBottom: 12 }}>
          {error}
        </p>
      )}

      {result && (
        <>
          <div style={{
            background: '#f6f8fa',
            border: '1px solid #d0d7de',
            borderRadius: 6,
            padding: '14px 16px',
            marginBottom: 12,
            color: '#24292f',
          }}>
            <div style={{ fontSize: 14, color: '#24292f', lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap' }}>
              {result.answer}
            </div>
          </div>

          {result.sources.length > 0 && (
            <div>
              <p className="muted" style={{ fontSize: 12, marginBottom: 6, margin: '0 0 6px' }}>
                Sources
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {result.sources.map(src => (
                  <code
                    key={src}
                    style={{
                      fontSize: 11,
                      color: 'var(--b4)',
                      background: 'rgba(27,144,255,0.1)',
                      border: '1px solid rgba(27,144,255,0.2)',
                      borderRadius: 4,
                      padding: '2px 8px',
                    }}
                  >
                    {src}
                  </code>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
