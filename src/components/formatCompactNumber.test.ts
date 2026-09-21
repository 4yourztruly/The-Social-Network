import { describe, expect, it } from 'vitest'
import { formatCompactNumber } from './formatCompactNumber'

describe('formatCompactNumber', () => {
  it('shows the plain number below 1000', () => {
    expect(formatCompactNumber(999)).toBe('999')
    expect(formatCompactNumber(0)).toBe('0')
    expect(formatCompactNumber(-50)).toBe('-50')
  })

  it('abbreviates thousands as lowercase k', () => {
    expect(formatCompactNumber(500_000)).toBe('500k')
    expect(formatCompactNumber(2_000)).toBe('2k')
    expect(formatCompactNumber(-2_000)).toBe('-2k')
  })

  it('abbreviates millions as lowercase m', () => {
    expect(formatCompactNumber(50_000_000)).toBe('50m')
  })
})
