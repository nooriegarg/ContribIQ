/**
 * Tests for OnboardingPage cache-versioning and regenerate-plan behavior.
 *
 * OnboardingPage caches the generated plan in sessionStorage under a versioned
 * key (`onboarding-plan-v2-{taskId}`). Bumping the version constant busts old
 * Ollama-generated plans so Claude-generated plans are fetched fresh.
 *
 * We test the logic via a minimal harness that mirrors the caching/fetch state
 * machine without mounting the full page and its transitive dependencies.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useEffect, useState } from 'react'

const PLAN_CACHE_VERSION = 'v2'

function makeStorageMock() {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { store = {} },
  }
}

const ssMock = makeStorageMock()
vi.stubGlobal('sessionStorage', ssMock)

interface Plan { title: string }

function OnboardingHarness({
  taskId,
  fetchPlan,
}: {
  taskId: string
  fetchPlan: () => Promise<Plan>
}) {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const cacheKey = `onboarding-plan-${PLAN_CACHE_VERSION}-${taskId}`
    const cached = sessionStorage.getItem(cacheKey)
    if (cached && attempt === 0) {
      setPlan(JSON.parse(cached))
      setLoading(false)
      return
    }

    let active = true
    setPlan(null)
    setLoading(true)
    fetchPlan()
      .then(data => {
        if (!active) return
        sessionStorage.setItem(cacheKey, JSON.stringify(data))
        setPlan(data)
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [taskId, attempt, fetchPlan])

  if (loading) return <div data-testid="loading">Loading...</div>
  return (
    <div>
      <div data-testid="plan-title">{plan?.title ?? 'no plan'}</div>
      <button data-testid="regenerate" onClick={() => setAttempt(a => a + 1)}>
        Regenerate plan
      </button>
    </div>
  )
}

describe('OnboardingPage — cache versioning', () => {
  beforeEach(() => ssMock.clear())

  it('serves cached plan immediately without calling fetch when v2 cache exists', async () => {
    const cached = { title: 'Cached plan' }
    ssMock.setItem('onboarding-plan-v2-task-1', JSON.stringify(cached))

    const fetchPlan = vi.fn().mockResolvedValue({ title: 'Fresh plan' })
    render(<OnboardingHarness taskId="task-1" fetchPlan={fetchPlan} />)

    await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument())
    expect(screen.getByTestId('plan-title')).toHaveTextContent('Cached plan')
    expect(fetchPlan).not.toHaveBeenCalled()
  })

  it('fetches fresh plan when no v2 cache exists (old v1 key ignored)', async () => {
    // Seed an old-format key — should NOT be served
    ssMock.setItem('onboarding-plan-task-1', JSON.stringify({ title: 'Old Ollama plan' }))

    const fetchPlan = vi.fn().mockResolvedValue({ title: 'Fresh Claude plan' })
    render(<OnboardingHarness taskId="task-1" fetchPlan={fetchPlan} />)

    await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument())
    expect(fetchPlan).toHaveBeenCalledOnce()
    expect(screen.getByTestId('plan-title')).toHaveTextContent('Fresh Claude plan')
  })

  it('fetches fresh plan for a new taskId with no cache', async () => {
    const fetchPlan = vi.fn().mockResolvedValue({ title: 'New repo plan' })
    render(<OnboardingHarness taskId="task-new" fetchPlan={fetchPlan} />)

    await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument())
    expect(fetchPlan).toHaveBeenCalledOnce()
    expect(screen.getByTestId('plan-title')).toHaveTextContent('New repo plan')
  })

  it('stores fetched plan under the versioned key for future visits', async () => {
    const fetchPlan = vi.fn().mockResolvedValue({ title: 'Stored plan' })
    render(<OnboardingHarness taskId="task-store" fetchPlan={fetchPlan} />)

    await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument())
    const stored = ssMock.getItem('onboarding-plan-v2-task-store')
    expect(stored).not.toBeNull()
    expect(JSON.parse(stored!).title).toBe('Stored plan')
  })

  it('does not pollute the old unversioned key', async () => {
    const fetchPlan = vi.fn().mockResolvedValue({ title: 'Plan' })
    render(<OnboardingHarness taskId="task-x" fetchPlan={fetchPlan} />)

    await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument())
    expect(ssMock.getItem('onboarding-plan-task-x')).toBeNull()
  })
})

describe('OnboardingPage — regenerate button', () => {
  beforeEach(() => ssMock.clear())

  it('shows the Regenerate plan button when plan is loaded', async () => {
    ssMock.setItem('onboarding-plan-v2-task-1', JSON.stringify({ title: 'Plan' }))
    const fetchPlan = vi.fn().mockResolvedValue({ title: 'Plan' })
    render(<OnboardingHarness taskId="task-1" fetchPlan={fetchPlan} />)

    await waitFor(() => expect(screen.queryByTestId('loading')).not.toBeInTheDocument())
    expect(screen.getByTestId('regenerate')).toBeInTheDocument()
  })

  it('clicking Regenerate bypasses cache and fetches a fresh plan', async () => {
    ssMock.setItem('onboarding-plan-v2-task-1', JSON.stringify({ title: 'Old plan' }))
    const fetchPlan = vi.fn().mockResolvedValue({ title: 'Regenerated plan' })
    render(<OnboardingHarness taskId="task-1" fetchPlan={fetchPlan} />)

    await waitFor(() => expect(screen.getByTestId('plan-title')).toHaveTextContent('Old plan'))
    expect(fetchPlan).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('regenerate'))
    await waitFor(() => expect(screen.getByTestId('plan-title')).toHaveTextContent('Regenerated plan'))
    expect(fetchPlan).toHaveBeenCalledOnce()
  })

  it('updates the cache with the regenerated plan', async () => {
    ssMock.setItem('onboarding-plan-v2-task-1', JSON.stringify({ title: 'Old plan' }))
    const fetchPlan = vi.fn().mockResolvedValue({ title: 'New plan' })
    render(<OnboardingHarness taskId="task-1" fetchPlan={fetchPlan} />)

    await waitFor(() => expect(screen.getByTestId('plan-title')).toHaveTextContent('Old plan'))
    fireEvent.click(screen.getByTestId('regenerate'))
    await waitFor(() => expect(screen.getByTestId('plan-title')).toHaveTextContent('New plan'))

    const cached = ssMock.getItem('onboarding-plan-v2-task-1')
    expect(JSON.parse(cached!).title).toBe('New plan')
  })

  it('can regenerate multiple times', async () => {
    const fetchPlan = vi.fn()
      .mockResolvedValueOnce({ title: 'Plan A' })
      .mockResolvedValueOnce({ title: 'Plan B' })
    render(<OnboardingHarness taskId="task-multi" fetchPlan={fetchPlan} />)

    await waitFor(() => expect(screen.getByTestId('plan-title')).toHaveTextContent('Plan A'))
    fireEvent.click(screen.getByTestId('regenerate'))
    await waitFor(() => expect(screen.getByTestId('plan-title')).toHaveTextContent('Plan B'))
    expect(fetchPlan).toHaveBeenCalledTimes(2)
  })
})
