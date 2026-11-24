import { describe, it, expect, beforeEach } from 'vitest'

// ─── WorkflowLayout progress helpers ─────────────────────────────────────────
// These replicate the localStorage helpers in WorkflowLayout.tsx so we can
// test the progression logic without rendering the full component.

const PROGRESS_KEY = (id: string) => `contribiq:progress:${id}`

function loadProgress(taskId: string): number {
  try {
    const val = parseInt(localStorage.getItem(PROGRESS_KEY(taskId)) ?? '1', 10)
    return isNaN(val) ? 1 : Math.max(1, val)
  }
  catch { return 1 /* parse error or storage unavailable */ }
}

function saveProgress(taskId: string, step: number) {
  try { localStorage.setItem(PROGRESS_KEY(taskId), String(step)) } catch { /* storage unavailable */ }
}

describe('loadProgress', () => {
  beforeEach(() => localStorage.clear())

  it('returns 1 when no entry exists', () => {
    expect(loadProgress('task-abc')).toBe(1)
  })

  it('returns stored step value', () => {
    localStorage.setItem(PROGRESS_KEY('task-abc'), '3')
    expect(loadProgress('task-abc')).toBe(3)
  })

  it('clamps to minimum of 1 for invalid values', () => {
    localStorage.setItem(PROGRESS_KEY('task-abc'), '0')
    expect(loadProgress('task-abc')).toBe(1)
  })

  it('clamps to minimum of 1 for negative values', () => {
    localStorage.setItem(PROGRESS_KEY('task-abc'), '-5')
    expect(loadProgress('task-abc')).toBe(1)
  })

  it('returns 1 for non-numeric stored value', () => {
    localStorage.setItem(PROGRESS_KEY('task-abc'), 'bad')
    expect(loadProgress('task-abc')).toBe(1)
  })

  it('is scoped per taskId', () => {
    localStorage.setItem(PROGRESS_KEY('task-1'), '2')
    localStorage.setItem(PROGRESS_KEY('task-2'), '4')
    expect(loadProgress('task-1')).toBe(2)
    expect(loadProgress('task-2')).toBe(4)
  })
})

describe('saveProgress', () => {
  beforeEach(() => localStorage.clear())

  it('persists step to localStorage', () => {
    saveProgress('task-abc', 3)
    expect(localStorage.getItem(PROGRESS_KEY('task-abc'))).toBe('3')
  })

  it('overwrites previous value', () => {
    saveProgress('task-abc', 2)
    saveProgress('task-abc', 4)
    expect(localStorage.getItem(PROGRESS_KEY('task-abc'))).toBe('4')
  })

  it('is scoped per taskId', () => {
    saveProgress('task-1', 2)
    saveProgress('task-2', 5)
    expect(localStorage.getItem(PROGRESS_KEY('task-1'))).toBe('2')
    expect(localStorage.getItem(PROGRESS_KEY('task-2'))).toBe('5')
  })
})

// ─── Step lock logic ──────────────────────────────────────────────────────────
// Mirrors the disabled condition in WorkflowLayout:
//   disabled = !result || (index + 1 > maxStep + 1) || (index === 4 && !issueNumber)

function isStepLocked(index: number, maxStep: number, hasResult: boolean, issueNumber?: number): boolean {
  return !hasResult || (index + 1 > maxStep + 1) || (index === 4 && !issueNumber)
}

describe('step lock logic', () => {
  it('locks all steps when result is not loaded', () => {
    for (let i = 0; i < 5; i++) {
      expect(isStepLocked(i, 1, false)).toBe(true)
    }
  })

  it('unlocks only step 1 and 2 when maxStep is 1', () => {
    expect(isStepLocked(0, 1, true)).toBe(false) // step 1 — current
    expect(isStepLocked(1, 1, true)).toBe(false) // step 2 — next allowed
    expect(isStepLocked(2, 1, true)).toBe(true)  // step 3 — locked
    expect(isStepLocked(3, 1, true)).toBe(true)  // step 4 — locked
    expect(isStepLocked(4, 1, true)).toBe(true)  // step 5 — locked
  })

  it('unlocks up to step 3 when maxStep is 2', () => {
    expect(isStepLocked(0, 2, true)).toBe(false)
    expect(isStepLocked(1, 2, true)).toBe(false)
    expect(isStepLocked(2, 2, true)).toBe(false)
    expect(isStepLocked(3, 2, true)).toBe(true)
    expect(isStepLocked(4, 2, true)).toBe(true)
  })

  it('unlocks all steps when maxStep is 5', () => {
    expect(isStepLocked(0, 5, true, 42)).toBe(false)
    expect(isStepLocked(1, 5, true, 42)).toBe(false)
    expect(isStepLocked(2, 5, true, 42)).toBe(false)
    expect(isStepLocked(3, 5, true, 42)).toBe(false)
    expect(isStepLocked(4, 5, true, 42)).toBe(false)
  })

  it('locks step 5 when maxStep is 5 but issueNumber is missing', () => {
    expect(isStepLocked(4, 5, true, undefined)).toBe(true)
  })
})

// ─── isDone / isActive logic ──────────────────────────────────────────────────
// Mirrors the class logic in WorkflowLayout:
//   isDone  = index + 1 <= maxStep && index + 1 !== currentStep
//   isActive = index + 1 === currentStep

function getStepState(index: number, currentStep: number, maxStep: number): 'active' | 'done' | 'pending' {
  if (index + 1 === currentStep) return 'active'
  if (index + 1 <= maxStep && index + 1 !== currentStep) return 'done'
  return 'pending'
}

describe('step state (isDone / isActive)', () => {
  it('marks only the current step as active', () => {
    expect(getStepState(0, 1, 1)).toBe('active')
    expect(getStepState(1, 1, 1)).toBe('pending')
  })

  it('marks visited steps as done when user moves forward', () => {
    // user is on step 3, has visited up to step 3
    expect(getStepState(0, 3, 3)).toBe('done')
    expect(getStepState(1, 3, 3)).toBe('done')
    expect(getStepState(2, 3, 3)).toBe('active')
    expect(getStepState(3, 3, 3)).toBe('pending')
    expect(getStepState(4, 3, 3)).toBe('pending')
  })

  it('does not mark unvisited steps as done', () => {
    // user is on step 1, maxStep is 1 — steps 2-5 should be pending
    expect(getStepState(1, 1, 1)).toBe('pending')
    expect(getStepState(2, 1, 1)).toBe('pending')
  })

  it('marks steps as done when user navigates back', () => {
    // user has reached step 5 but navigated back to step 2
    expect(getStepState(0, 2, 5)).toBe('done') // step 1 done
    expect(getStepState(1, 2, 5)).toBe('active') // step 2 active
    expect(getStepState(2, 2, 5)).toBe('done') // step 3 done (was visited)
    expect(getStepState(3, 2, 5)).toBe('done') // step 4 done
    expect(getStepState(4, 2, 5)).toBe('done') // step 5 done
  })

  it('active step is never marked as done', () => {
    for (let step = 1; step <= 5; step++) {
      expect(getStepState(step - 1, step, 5)).toBe('active')
    }
  })
})
