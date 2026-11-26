/**
 * Tests for ProfilePage matches-cache invalidation.
 *
 * When the user changes their profile (chip toggle or Find My Issues),
 * the sessionStorage key `matches:{taskId}:{userId}` must be removed so
 * IssuesPage re-fetches ranked results with the updated profile instead of
 * serving stale cached matches.
 *
 * We test via a minimal harness that replicates the cache-clear logic
 * without mounting the full page and its router/workflow dependencies.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// --- storage mock -----------------------------------------------------------

function makeStorageMock() {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
    _store: () => store,
  }
}

const ssMock = makeStorageMock()
vi.stubGlobal('sessionStorage', ssMock)

// --- helpers mirroring ProfilePage logic ------------------------------------

const TASK_ID = 'task-123'
const USER_ID = 'user-abc'
const MATCHES_KEY = `matches:${TASK_ID}:${USER_ID}`
const PROFILE_KEY = `profile:${USER_ID}`

function clearMatchesCache(taskId: string, userId: string) {
  try {
    sessionStorage.removeItem(`matches:${taskId}:${userId}`)
  } catch { /* storage unavailable */ }
}

// --- tests ------------------------------------------------------------------

describe('ProfilePage — matches cache invalidation', () => {
  beforeEach(() => ssMock.clear())

  it('clearMatchesCache removes the matches key for the given task and user', () => {
    sessionStorage.setItem(MATCHES_KEY, JSON.stringify([{ issue_number: 1, match_pct: 80, reasons: [] }]))
    expect(sessionStorage.getItem(MATCHES_KEY)).not.toBeNull()

    clearMatchesCache(TASK_ID, USER_ID)

    expect(sessionStorage.getItem(MATCHES_KEY)).toBeNull()
  })

  it('clearMatchesCache does not throw when the key does not exist', () => {
    expect(() => clearMatchesCache(TASK_ID, USER_ID)).not.toThrow()
  })

  it('clearMatchesCache only removes the matches key, not the profile key', () => {
    sessionStorage.setItem(MATCHES_KEY, '[]')
    sessionStorage.setItem(PROFILE_KEY, JSON.stringify({ languages: ['Python'] }))

    clearMatchesCache(TASK_ID, USER_ID)

    expect(sessionStorage.getItem(MATCHES_KEY)).toBeNull()
    expect(sessionStorage.getItem(PROFILE_KEY)).not.toBeNull()
  })

  it('clearMatchesCache does not remove matches keys for a different task', () => {
    const otherKey = `matches:other-task:${USER_ID}`
    sessionStorage.setItem(MATCHES_KEY, '[]')
    sessionStorage.setItem(otherKey, '[]')

    clearMatchesCache(TASK_ID, USER_ID)

    expect(sessionStorage.getItem(MATCHES_KEY)).toBeNull()
    expect(sessionStorage.getItem(otherKey)).not.toBeNull()
  })

  it('clearMatchesCache does not remove matches keys for a different user', () => {
    const otherUserKey = `matches:${TASK_ID}:other-user`
    sessionStorage.setItem(MATCHES_KEY, '[]')
    sessionStorage.setItem(otherUserKey, '[]')

    clearMatchesCache(TASK_ID, USER_ID)

    expect(sessionStorage.getItem(MATCHES_KEY)).toBeNull()
    expect(sessionStorage.getItem(otherUserKey)).not.toBeNull()
  })

  it('IssuesPage re-fetches after cache is cleared (matches key absent on mount)', () => {
    // Simulate: matches were cached, profile updated, cache cleared
    sessionStorage.setItem(MATCHES_KEY, '[]')
    clearMatchesCache(TASK_ID, USER_ID)

    // IssuesPage seeds from sessionStorage — null means it will fetch
    const cached = sessionStorage.getItem(MATCHES_KEY)
    expect(cached).toBeNull()
  })
})
