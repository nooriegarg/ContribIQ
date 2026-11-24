import { useState } from 'react'

interface Props {
  commands: string[]
}

export default function CodeBlock({ commands }: Props) {
  const [copied, setCopied] = useState(false)

  if (commands.length === 0) return null

  const handleCopy = () => {
    navigator.clipboard.writeText(commands.join('\n')).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="code-wrap">
      <button className="copy-btn" onClick={handleCopy} title="Copy to clipboard">
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <pre className="code-block"><code>{commands.join('\n')}</code></pre>
    </div>
  )
}
