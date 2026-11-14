interface Props {
  files: { path: string; purpose: string }[]
}

export default function FileReadList({ files }: Props) {
  if (files.length === 0) return null

  return (
    <ul className="file-read-list">
      {files.map(file => (
        <li key={file.path}>
          <span className="file-read-icon" aria-hidden="true">&lt;/&gt;</span>
          <code>{file.path}</code>
          <span className="file-read-purpose">{file.purpose}</span>
        </li>
      ))}
    </ul>
  )
}
