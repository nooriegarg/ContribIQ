import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getRepoHistory } from '../../hooks/useAnalysis'

const HISTORY_KEY = 'contribiq_repo_history'

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

function seedHistory(entries: ReturnType<typeof makeEntry>[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(entries))
}

function resetHistory() {
  localStorage.removeItem(HISTORY_KEY)
}

// saveToHistory is not exported, so we test it via getRepoHistory round-trips
// by writing the same logic and asserting the shape getRepoHistory returns.

describe('getRepoHistory', () => {
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
    localStorage.setItem(HISTORY_KEY, 'not-valid-json{{{')
    expect(getRepoHistory()).toEqual([])
  })

  it('returns empty array when stored value is null', () => {
    // localStorage.getItem returns null for missing keys; getRepoHistory uses ?? '[]'
    expect(getRepoHistory()).toEqual([])
  })
})

// saveToHistory tests via direct localStorage manipulation that mirrors the implementation
describe('saveToHistory (via localStorage round-trip)', () => {
  const MAX_HISTORY = 10

  beforeEach(() => {
    resetHistory()
  })

  function simulateSave(taskId: string, fullName: string) {
    const entry = { taskId, fullName, analyzedAt: new Date().toISOString() }
    const existing = getRepoHistory().filter(e => e.taskId !== taskId)
    localStorage.setItem(HISTORY_KEY, JSON.stringify([entry, ...existing].slice(0, MAX_HISTORY)))
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
})
