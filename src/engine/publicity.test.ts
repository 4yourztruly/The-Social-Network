import { describe, expect, it } from 'vitest'
import { isPublicScene } from './publicity'

describe('isPublicScene', () => {
  it('keeps quiet moments private and night-out moments public', () => {
    expect(isPublicScene('Quiet dinner at home with Jamie')).toBe(false)
    expect(isPublicScene('Movie night on the couch')).toBe(false)
    expect(isPublicScene('Night out at a club in the city')).toBe(true)
    expect(isPublicScene('Paparazzi spot you leaving a restaurant')).toBe(true)
    expect(isPublicScene('Hanging out', ['party'])).toBe(true)
  })
})

import { LEAK_CHANCE, resolvePublicity } from './publicity'

describe('resolvePublicity', () => {
  it('a private moment usually stays private but the paparazzi can find out', () => {
    expect(resolvePublicity('quiet dinner at home', [], LEAK_CHANCE + 0.01)).toEqual({ isPublic: false, leaked: false })
    expect(resolvePublicity('quiet dinner at home', [], 0.01)).toEqual({ isPublic: true, leaked: true })
    expect(resolvePublicity('night out at a club', [], 0.9)).toEqual({ isPublic: true, leaked: false })
  })
})
