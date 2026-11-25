import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getRepoHistory, removeFromHistory } from '../../hooks/useAnalysis'

const HISTORY_KEY_LEGACY = 'contribiq_repo_history'
const USER_ID = 'user-abc123'
const HISTORY_KEY_SCOPED = `contribiq_repo_history_${USER_ID}`

// The test environment may replace localStorage with a minimal stub that lacks
// clear/removeItem. We use our own in-memory implementation so tests are reliable.
function makeLocalStorageMock() {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
}

const lsMock = makeLocalStorageMock()
vi.stubGlobal('localStorage', lsMock)

function makeEntry(taskId: string, fullName = `owner/${taskId}`, analyzedAt = new Date().toISOString()) {
  return { taskId, fullName, analyzedAt }
}

function seedHistory(entries: ReturnType<typeof makeEntry>[], key = HISTORY_KEY_LEGACY) {
  localStorage.setItem(key, JSON.stringify(entries))
}

function resetHistory() {
  lsMock.clear()
}

// saveToHistory is not exported, so we test it via getRepoHistory round-trips
// by writing the same logic and asserting the shape getRepoHistory returns.

describe('getRepoHistory — legacy key (no userId)', () => {
  beforeEach(() => {
    resetHistory()
  })

  it('returns empty array when localStorage is empty', () => {
    expect(getRepoHistory()).toEqual([])
  })

  it('returns stored entries in order', () => {
    const entries = [makeEntry('t1', 'o/r1'), makeEntry('t2', 'o/r2')]
    seedHistory(entries)
    expect(getRepoHistory()).toEqual(entries)
  })

  it('returns empty array on malformed JSON', () => {
    localStorage.setItem(HISTORY_KEY_LEGACY, 'not-valid-json{{{')
    expect(getRepoHistory()).toEqual([])
  })

  it('returns empty array when stored value is null', () => {
    // localStorage.getItem returns null for missing keys; getRepoHistory uses ?? '[]'
    expect(getRepoHistory()).toEqual([])
  })
})

describe('getRepoHistory — per-user scoped key', () => {
  beforeEach(() => {
    resetHistory()
  })

  it('returns entries from the user-scoped key when userId is provided', () => {
    const scopedEntries = [makeEntry('s1', 'scoped/repo')]
    seedHistory(scopedEntries, HISTORY_KEY_SCOPED)
    expect(getRepoHistory(USER_ID)).toEqual(scopedEntries)
  })

  it('does not return entries from the legacy key when userId is provided', () => {
    const legacyEntries = [makeEntry('l1', 'legacy/repo')]
    seedHistory(legacyEntries, HISTORY_KEY_LEGACY)
    // scoped key is empty → returns []
    expect(getRepoHistory(USER_ID)).toEqual([])
  })

  it('does not leak between two different users', () => {
    const user1 = 'user-111'
    const user2 = 'user-222'
    const e1 = [makeEntry('t1', 'user1/repo')]
    const e2 = [makeEntry('t2', 'user2/repo')]
    localStorage.setItem(`contribiq_repo_history_${user1}`, JSON.stringify(e1))
    localStorage.setItem(`contribiq_repo_history_${user2}`, JSON.stringify(e2))
    expect(getRepoHistory(user1)).toEqual(e1)
    expect(getRepoHistory(user2)).toEqual(e2)
  })

  it('returns empty array on malformed JSON in scoped key', () => {
    localStorage.setItem(HISTORY_KEY_SCOPED, '{{{bad')
    expect(getRepoHistory(USER_ID)).toEqual([])
  })

  it('returns empty array when scoped key is absent', () => {
    expect(getRepoHistory(USER_ID)).toEqual([])
  })
})

// saveToHistory tests via direct localStorage manipulation that mirrors the implementation
describe('saveToHistory (via localStorage round-trip)', () => {
  const MAX_HISTORY = 10

  beforeEach(() => {
    resetHistory()
  })

  function simulateSave(taskId: string, fullName: string, userId?: string) {
    const key = userId ? `contribiq_repo_history_${userId}` : HISTORY_KEY_LEGACY
    const entry = { taskId, fullName, analyzedAt: new Date().toISOString() }
    const existing = getRepoHistory(userId).filter(e => e.taskId !== taskId)
    localStorage.setItem(key, JSON.stringify([entry, ...existing].slice(0, MAX_HISTORY)))
  }

  it('adds a new entry as the first item', () => {
    simulateSave('abc123', 'facebook/react')
    const history = getRepoHistory()
    expect(history).toHaveLength(1)
    expect(history[0].taskId).toBe('abc123')
    expect(history[0].fullName).toBe('facebook/react')
  })

  it('prepends newer entries so the most recent is first', () => {
    simulateSave('t1', 'o/r1')
    simulateSave('t2', 'o/r2')
    const history = getRepoHistory()
    expect(history[0].taskId).toBe('t2')
    expect(history[1].taskId).toBe('t1')
  })

  it('deduplicates by taskId (same taskId replaces the old entry at position 0)', () => {
    simulateSave('t1', 'o/r1')
    simulateSave('t2', 'o/r2')
    simulateSave('t1', 'o/r1-updated')
    const history = getRepoHistory()
    expect(history).toHaveLength(2)
    expect(history[0].taskId).toBe('t1')
    expect(history[0].fullName).toBe('o/r1-updated')
  })

  it('caps the list at MAX_HISTORY (10) entries', () => {
    for (let i = 0; i < MAX_HISTORY + 3; i++) {
      simulateSave(`task-${i}`, `owner/repo-${i}`)
    }
    expect(getRepoHistory()).toHaveLength(MAX_HISTORY)
  })

  it('stores the most recent entry when cap is reached', () => {
    for (let i = 0; i < MAX_HISTORY + 3; i++) {
      simulateSave(`task-${i}`, `owner/repo-${i}`)
    }
    // The last saved entry should be first
    expect(getRepoHistory()[0].taskId).toBe(`task-${MAX_HISTORY + 2}`)
  })

  it('stores the analyzedAt timestamp as an ISO string', () => {
    simulateSave('x1', 'o/r')
    const entry = getRepoHistory()[0]
    expect(() => new Date(entry.analyzedAt)).not.toThrow()
    expect(isNaN(new Date(entry.analyzedAt).getTime())).toBe(false)
  })

  it('scoped save does not affect legacy key', () => {
    simulateSave('scoped-task', 'scoped/repo', USER_ID)
    expect(getRepoHistory()).toEqual([])
    expect(getRepoHistory(USER_ID)).toHaveLength(1)
  })

  it('legacy save does not affect scoped key', () => {
    simulateSave('legacy-task', 'legacy/repo')
    expect(getRepoHistory(USER_ID)).toEqual([])
    expect(getRepoHistory()).toHaveLength(1)
  })
})

describe('removeFromHistory', () => {
  beforeEach(() => {
    resetHistory()
  })

  it('removes the matching entry and returns the updated list', () => {
    seedHistory([makeEntry('t1', 'o/r1'), makeEntry('t2', 'o/r2'), makeEntry('t3', 'o/r3')])
    const result = removeFromHistory('t2')
    expect(result).toHaveLength(2)
    expect(result.map(e => e.taskId)).toEqual(['t1', 't3'])
  })

  it('persists the filtered list to localStorage', () => {
    seedHistory([makeEntry('t1', 'o/r1'), makeEntry('t2', 'o/r2')])
    removeFromHistory('t1')
    expect(getRepoHistory()).toHaveLength(1)
    expect(getRepoHistory()[0].taskId).toBe('t2')
  })

  it('returns empty array when removing the only entry', () => {
    seedHistory([makeEntry('solo', 'o/r')])
    const result = removeFromHistory('solo')
    expect(result).toEqual([])
    expect(getRepoHistory()).toEqual([])
  })

  it('returns unchanged list when taskId is not found', () => {
    const entries = [makeEntry('t1', 'o/r1'), makeEntry('t2', 'o/r2')]
    seedHistory(entries)
    const result = removeFromHistory('nonexistent')
    expect(result).toHaveLength(2)
    expect(result.map(e => e.taskId)).toEqual(['t1', 't2'])
  })

  it('returns empty array when history is empty', () => {
    const result = removeFromHistory('anything')
    expect(result).toEqual([])
  })

  it('preserves entry order after removal', () => {
    seedHistory([makeEntry('a'), makeEntry('b'), makeEntry('c'), makeEntry('d')])
    const result = removeFromHistory('b')
    expect(result.map(e => e.taskId)).toEqual(['a', 'c', 'd'])
  })

  it('removes from the scoped key when userId is provided', () => {
    seedHistory([makeEntry('s1', 'scoped/r1'), makeEntry('s2', 'scoped/r2')], HISTORY_KEY_SCOPED)
    const result = removeFromHistory('s1', USER_ID)
    expect(result).toHaveLength(1)
    expect(result[0].taskId).toBe('s2')
    expect(getRepoHistory(USER_ID)).toHaveLength(1)
  })

  it('scoped removal does not affect legacy key', () => {
    seedHistory([makeEntry('t1', 'o/r1')], HISTORY_KEY_LEGACY)
    seedHistory([makeEntry('t1', 'o/r1')], HISTORY_KEY_SCOPED)
    removeFromHistory('t1', USER_ID)
    // legacy key should be untouched
    expect(getRepoHistory()).toHaveLength(1)
    expect(getRepoHistory(USER_ID)).toHaveLength(0)
  })
})
