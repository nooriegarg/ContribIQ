/**
 * Tests for the LoginPage post-login redirect logic.
 *
 * LoginPage's handleRedirect reads from getRepoHistory(userId) and navigates
 * accordingly. We test via a minimal harness that directly calls the same
 * logic without mounting the full page and all its transitive CSS/router deps.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// --- localStorage mock ---
function makeStorageMock() {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
}
const lsMock = makeStorageMock()
vi.stubGlobal('localStorage', lsMock)

import { getRepoHistory } from '../../hooks/useAnalysis'

const LEGACY_KEY = 'contribiq_repo_history'

function scopedKey(userId: string) {
  return `contribiq_repo_history_${userId}`
}

function makeEntry(taskId: string, fullName = `owner/${taskId}`) {
  return { taskId, fullName, analyzedAt: new Date().toISOString() }
}

// Replicate the handleRedirect logic from LoginPage
function handleRedirect({
  isSignup,
  userId,
}: {
  isSignup: boolean
  userId?: string
}): string {
  if (isSignup) return '/onboarding-setup'
  const history = getRepoHistory(userId)
  if (history.length > 0) {
    return `/overview/${encodeURIComponent(history[0].taskId)}`
  }
  return '/dashboard'
}

describe('LoginPage redirect — post-signup', () => {
  it('always redirects to /onboarding-setup after signup regardless of history', () => {
    lsMock.clear()
    localStorage.setItem(LEGACY_KEY, JSON.stringify([makeEntry('t1', 'o/r1')]))
    expect(handleRedirect({ isSignup: true })).toBe('/onboarding-setup')
  })
})

describe('LoginPage redirect — post-login with no history', () => {
  beforeEach(() => { lsMock.clear() })

  it('redirects to /dashboard when history is empty (no userId)', () => {
    expect(handleRedirect({ isSignup: false })).toBe('/dashboard')
  })

  it('redirects to /dashboard when scoped history is empty', () => {
    expect(handleRedirect({ isSignup: false, userId: 'user-xyz' })).toBe('/dashboard')
  })

  it('redirects to /dashboard when only legacy history exists but userId given', () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([makeEntry('t1')]))
    // userId-scoped key is empty → dashboard
    expect(handleRedirect({ isSignup: false, userId: 'user-xyz' })).toBe('/dashboard')
  })
})

describe('LoginPage redirect — post-login with existing history', () => {
  beforeEach(() => { lsMock.clear() })

  it('redirects to /overview/:taskId when legacy history exists (no userId)', () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify([makeEntry('task-123', 'facebook/react')]))
    expect(handleRedirect({ isSignup: false })).toBe('/overview/task-123')
  })

  it('redirects to /overview/:taskId when scoped history exists', () => {
    const userId = 'user-abc'
    localStorage.setItem(scopedKey(userId), JSON.stringify([makeEntry('task-456', 'psf/requests')]))
    expect(handleRedirect({ isSignup: false, userId })).toBe('/overview/task-456')
  })

  it('uses the first (most recent) entry when multiple entries exist', () => {
    const userId = 'user-abc'
    localStorage.setItem(scopedKey(userId), JSON.stringify([
      makeEntry('latest-task', 'newest/repo'),
      makeEntry('older-task', 'older/repo'),
    ]))
    expect(handleRedirect({ isSignup: false, userId })).toBe('/overview/latest-task')
  })

  it('URL-encodes the taskId in the redirect path', () => {
    const userId = 'user-abc'
    const taskId = 'task/with spaces'
    localStorage.setItem(scopedKey(userId), JSON.stringify([makeEntry(taskId)]))
    const result = handleRedirect({ isSignup: false, userId })
    expect(result).toBe(`/overview/${encodeURIComponent(taskId)}`)
  })

  it('does not bleed history from one user into another', () => {
    const user1 = 'u1'
    const user2 = 'u2'
    localStorage.setItem(scopedKey(user1), JSON.stringify([makeEntry('task-u1')]))
    // user2 has no history
    expect(handleRedirect({ isSignup: false, userId: user2 })).toBe('/dashboard')
    expect(handleRedirect({ isSignup: false, userId: user1 })).toBe('/overview/task-u1')
  })
})
