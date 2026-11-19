import { useState } from 'react'
import { apiCall } from '../api/client'

interface QAResponse {
  answer: string
  sources: string[]
}

interface QAPanelProps {
  repoId: string
}

export default function QAPanel({ repoId }: QAPanelProps) {
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
        body: JSON.stringify({ repo_id: repoId, question: question.trim() }),
      })
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get answer')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="card">
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
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 6,
            color: 'var(--white)',
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
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 6,
            padding: '14px 16px',
            marginBottom: 12,
          }}>
            <p style={{ fontSize: 14, color: 'var(--white)', lineHeight: 1.65, margin: 0, whiteSpace: 'pre-wrap' }}>
              {result.answer}
            </p>
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
