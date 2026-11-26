/**
 * Tests for the fullName-based deduplication added to saveToHistory and
 * the read-time deduplication added to getRepoHistory.
 *
 * saveToHistory is not exported, so dedup-on-save is verified via
 * localStorage round-trips that mirror the implementation exactly.
 * getRepoHistory dedup-on-read is verified by seeding raw (possibly
 * stale/duplicate) data directly into localStorage.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getRepoHistory } from '../../hooks/useAnalysis'

const HISTORY_KEY = 'contribiq_repo_history'
const USER_ID = 'user-dedup-test'
const SCOPED_KEY = `contribiq_repo_history_${USER_ID}`
const MAX_HISTORY = 10

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

function makeEntry(taskId: string, fullName: string, analyzedAt = new Date().toISOString()) {
  return { taskId, fullName, analyzedAt }
}

/** Mirror the updated saveToHistory logic (deduplicates by both taskId AND fullName). */
function simulateSave(taskId: string, fullName: string, userId?: string) {
  const key = userId ? `contribiq_repo_history_${userId}` : HISTORY_KEY
  const entry = { taskId, fullName, analyzedAt: new Date().toISOString() }
  const existing = getRepoHistory(userId).filter(
    e => e.taskId !== taskId && e.fullName !== fullName,
  )
  localStorage.setItem(key, JSON.stringify([entry, ...existing].slice(0, MAX_HISTORY)))
}

// ─── dedup-on-save ────────────────────────────────────────────────────────────

describe('saveToHistory — fullName deduplication', () => {
  beforeEach(() => lsMock.clear())

  it('replaces an existing entry with the same fullName even if taskId differs', () => {
    simulateSave('task-old', 'nooriegarg/ContribIQ')
    simulateSave('task-new', 'nooriegarg/ContribIQ') // re-analysis → new taskId, same repo
    const history = getRepoHistory()
    expect(history).toHaveLength(1)
    expect(history[0].taskId).toBe('task-new')
    expect(history[0].fullName).toBe('nooriegarg/ContribIQ')
  })

  it('promotes the re-analysed entry to position 0', () => {
    simulateSave('task-a', 'owner/repoA')
    simulateSave('task-b', 'owner/repoB')
    simulateSave('task-a2', 'owner/repoA') // re-analyse repoA
    const history = getRepoHistory()
    expect(history[0].fullName).toBe('owner/repoA')
    expect(history[0].taskId).toBe('task-a2')
  })

  it('still deduplicates by taskId when fullName also matches', () => {
    simulateSave('task-x', 'owner/repo')
    simulateSave('task-x', 'owner/repo') // exact same task re-saved
    expect(getRepoHistory()).toHaveLength(1)
  })

  it('keeps different repos as separate entries', () => {
    simulateSave('t1', 'owner/repoA')
    simulateSave('t2', 'owner/repoB')
    simulateSave('t3', 'owner/repoC')
    expect(getRepoHistory()).toHaveLength(3)
  })

  it('works correctly with the user-scoped key', () => {
    simulateSave('task-old', 'org/repo', USER_ID)
    simulateSave('task-new', 'org/repo', USER_ID)
    const history = getRepoHistory(USER_ID)
    expect(history).toHaveLength(1)
    expect(history[0].taskId).toBe('task-new')
  })

  it('scoped dedup does not affect the legacy key', () => {
    simulateSave('task-legacy', 'org/repo')
    simulateSave('task-scoped', 'org/repo', USER_ID) // same fullName, different key
    expect(getRepoHistory()).toHaveLength(1)
    expect(getRepoHistory()[0].taskId).toBe('task-legacy')
    expect(getRepoHistory(USER_ID)).toHaveLength(1)
    expect(getRepoHistory(USER_ID)[0].taskId).toBe('task-scoped')
  })
})

// ─── dedup-on-read (self-healing stale localStorage data) ────────────────────

describe('getRepoHistory — read-time fullName deduplication', () => {
  beforeEach(() => lsMock.clear())

  it('removes duplicate fullNames, keeping the first occurrence', () => {
    const stale = [
      makeEntry('task-new', 'owner/repo'),  // most recent (index 0)
      makeEntry('task-old', 'owner/repo'),  // duplicate — should be dropped
      makeEntry('task-other', 'owner/other'),
    ]
    localStorage.setItem(HISTORY_KEY, JSON.stringify(stale))
    const history = getRepoHistory()
    expect(history).toHaveLength(2)
    expect(history[0].taskId).toBe('task-new')
    expect(history[1].taskId).toBe('task-other')
  })

  it('handles multiple groups of duplicates', () => {
    const stale = [
      makeEntry('t1a', 'owner/repoA'),
      makeEntry('t2a', 'owner/repoA'), // dup of repoA
      makeEntry('t1b', 'owner/repoB'),
      makeEntry('t2b', 'owner/repoB'), // dup of repoB
    ]
    localStorage.setItem(HISTORY_KEY, JSON.stringify(stale))
    const history = getRepoHistory()
    expect(history).toHaveLength(2)
    expect(history.map(e => e.fullName)).toEqual(['owner/repoA', 'owner/repoB'])
  })

  it('returns all entries unchanged when there are no duplicates', () => {
    const clean = [
      makeEntry('t1', 'owner/repoA'),
      makeEntry('t2', 'owner/repoB'),
      makeEntry('t3', 'owner/repoC'),
    ]
    localStorage.setItem(HISTORY_KEY, JSON.stringify(clean))
    expect(getRepoHistory()).toHaveLength(3)
  })

  it('deduplicates from the scoped key as well', () => {
    const stale = [
      makeEntry('task-new', 'org/repo'),
      makeEntry('task-old', 'org/repo'),
    ]
    localStorage.setItem(SCOPED_KEY, JSON.stringify(stale))
    expect(getRepoHistory(USER_ID)).toHaveLength(1)
    expect(getRepoHistory(USER_ID)[0].taskId).toBe('task-new')
  })
})
