import { beforeEach, describe, expect, it } from 'vitest'
import { canSpend, recordSpend, usageToday } from './budget'

beforeEach(() => {
  localStorage.clear()
})

describe('budget', () => {
  it('starts at zero usage', () => {
    expect(usageToday('groq')).toBe(0)
    expect(canSpend('groq', 5)).toBe(true)
  })

  it('increments usage on each spend', () => {
    recordSpend('groq')
    recordSpend('groq')
    expect(usageToday('groq')).toBe(2)
  })

  it('blocks spending once the daily budget is hit', () => {
    for (let i = 0; i < 5; i++) recordSpend('groq')
    expect(canSpend('groq', 5)).toBe(false)
    expect(canSpend('groq', 6)).toBe(true)
  })

  it('tracks providers independently', () => {
    recordSpend('groq')
    recordSpend('groq')
    recordSpend('gemini')
    expect(usageToday('groq')).toBe(2)
    expect(usageToday('gemini')).toBe(1)
  })
})
