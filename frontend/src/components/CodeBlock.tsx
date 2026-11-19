interface Props {
  commands: string[]
}

export default function CodeBlock({ commands }: Props) {
  if (commands.length === 0) return null

  return <pre className="code-block"><code>{commands.join('\n')}</code></pre>
}
