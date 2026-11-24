import { describe, it, expect } from 'vitest'
import { validateEmail, parseGitHubRepository } from '../../utils/validation'

describe('validateEmail', () => {
  it('accepts valid emails', () => {
    expect(validateEmail('user@example.com')).toBe(true)
    expect(validateEmail('user+tag@sub.domain.org')).toBe(true)
  })

  it('rejects invalid emails', () => {
    expect(validateEmail('')).toBe(false)
    expect(validateEmail('notanemail')).toBe(false)
    expect(validateEmail('@nodomain.com')).toBe(false)
    expect(validateEmail('no@tld')).toBe(false)
    expect(validateEmail('spaces in@email.com')).toBe(false)
  })

  it('trims whitespace before validating', () => {
    expect(validateEmail('  user@example.com  ')).toBe(true)
  })
})

describe('parseGitHubRepository', () => {
  it('parses owner/repo format', () => {
    expect(parseGitHubRepository('facebook/react')).toEqual({ owner: 'facebook', repo: 'react' })
  })

  it('parses full github.com URL', () => {
    expect(parseGitHubRepository('https://github.com/vercel/next.js')).toEqual({
      owner: 'vercel',
      repo: 'next.js',
    })
  })

  it('parses github.com URL without https', () => {
    expect(parseGitHubRepository('github.com/torvalds/linux')).toEqual({
      owner: 'torvalds',
      repo: 'linux',
    })
  })

  it('strips trailing .git suffix', () => {
    expect(parseGitHubRepository('owner/repo.git')).toEqual({ owner: 'owner', repo: 'repo' })
  })

  it('strips trailing slash', () => {
    expect(parseGitHubRepository('owner/repo/')).toEqual({ owner: 'owner', repo: 'repo' })
  })

  it('returns null for invalid input', () => {
    expect(parseGitHubRepository('')).toBeNull()
    expect(parseGitHubRepository('notarepo')).toBeNull()
    expect(parseGitHubRepository('owner/')).toBeNull()
    expect(parseGitHubRepository('/repo')).toBeNull()
  })

  it('returns null for reserved repo names', () => {
    expect(parseGitHubRepository('owner/.')).toBeNull()
    expect(parseGitHubRepository('owner/..')).toBeNull()
  })
})
