export function validateEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

export function parseGitHubRepository(value: string): { owner: string; repo: string } | null {
  const match = /^(?:(?:https:\/\/)?github\.com\/)?([a-z\d](?:[a-z\d-]{0,37}[a-z\d])?)\/([a-z\d_.-]{1,100})\/?$/i.exec(value.trim())
  if (!match) return null
  const repo = match[2].replace(/\.git$/i, '')
  if (!repo || repo === '.' || repo === '..') return null
  return { owner: match[1], repo }
}
