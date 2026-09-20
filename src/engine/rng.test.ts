import { describe, expect, it } from 'vitest'
import { hashStringToSeed, mulberry32, pick, randomInt } from './rng'

describe('mulberry32', () => {
  it('is deterministic for a given seed', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const seqA = Array.from({ length: 10 }, () => a())
    const seqB = Array.from({ length: 10 }, () => b())
    expect(seqA).toEqual(seqB)
  })

  it('produces values in [0, 1)', () => {
    const rng = mulberry32(1)
    for (let i = 0; i < 100; i++) {
      const v = rng()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })

  it('differs across seeds', () => {
    const a = mulberry32(1)()
    const b = mulberry32(2)()
    expect(a).not.toBe(b)
  })
})

describe('hashStringToSeed', () => {
  it('is stable for the same input', () => {
    expect(hashStringToSeed('hello')).toBe(hashStringToSeed('hello'))
  })

  it('differs for different input', () => {
    expect(hashStringToSeed('hello')).not.toBe(hashStringToSeed('world'))
  })
})

describe('pick', () => {
  it('always returns an element from the array', () => {
    const rng = mulberry32(7)
    const items = ['a', 'b', 'c']
    for (let i = 0; i < 50; i++) {
      expect(items).toContain(pick(rng, items))
    }
  })

  it('throws on an empty array', () => {
    const rng = mulberry32(7)
    expect(() => pick(rng, [])).toThrow()
  })
})

describe('randomInt', () => {
  it('stays within [min, max] inclusive', () => {
    const rng = mulberry32(3)
    for (let i = 0; i < 200; i++) {
      const v = randomInt(rng, 5, 8)
      expect(v).toBeGreaterThanOrEqual(5)
      expect(v).toBeLessThanOrEqual(8)
    }
  })
})
