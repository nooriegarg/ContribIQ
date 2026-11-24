import { describe, it, expect } from 'vitest'
import { formatCount } from '../../utils/format'

describe('formatCount', () => {
  it('returns plain string for numbers below 1000', () => {
    expect(formatCount(0)).toBe('0')
    expect(formatCount(1)).toBe('1')
    expect(formatCount(999)).toBe('999')
  })

  it('formats thousands with k suffix', () => {
    expect(formatCount(1000)).toBe('1.0k')
    expect(formatCount(1500)).toBe('1.5k')
    expect(formatCount(999999)).toBe('1000.0k')
  })

  it('formats millions with M suffix', () => {
    expect(formatCount(1_000_000)).toBe('1.0M')
    expect(formatCount(2_500_000)).toBe('2.5M')
  })

  it('prefers M over k for >= 1 million', () => {
    const result = formatCount(1_000_000)
    expect(result).toContain('M')
    expect(result).not.toContain('k')
  })
})
