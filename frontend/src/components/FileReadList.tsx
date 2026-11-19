interface Props {
  files: { path: string; purpose: string }[]
}

export default function FileReadList({ files }: Props) {
  if (files.length === 0) return null

  return (
    <ul className="file-reads">
      {files.map(file => (
        <li className="file-read" key={file.path}>
          <span className="file-read-icon" aria-hidden="true">&lt;/&gt;</span>
          <code className="fr-path">{file.path}</code>
          <span className="fr-desc">{file.purpose}</span>
        </li>
      ))}
    </ul>
  )
}
