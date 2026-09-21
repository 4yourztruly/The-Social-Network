import { describe, expect, it } from 'vitest'
import { mulberry32 } from './rng'
import {
  commentCountForPost,
  estimateEngagement,
  followerDeltaFromEngagement,
  statDeltasForTags,
} from './formulas'

describe('estimateEngagement', () => {
  it('is deterministic for a given seed', () => {
    const a = estimateEngagement(mulberry32(1), 100_000, 60, ['big_moment'])
    const b = estimateEngagement(mulberry32(1), 100_000, 60, ['big_moment'])
    expect(a).toEqual(b)
  })

  it('scales up with a high-multiplier tag like huge_moment vs a plain post', () => {
    const plain = estimateEngagement(mulberry32(5), 500_000, 60, [])
    const hugeMoment = estimateEngagement(mulberry32(5), 500_000, 60, ['huge_moment'])
    expect(hugeMoment.likes).toBeGreaterThan(plain.likes)
  })

  it('never returns negative counts', () => {
    const rng = mulberry32(42)
    for (let i = 0; i < 50; i++) {
      const e = estimateEngagement(rng, 0, 0, [])
      expect(e.likes).toBeGreaterThanOrEqual(0)
      expect(e.reposts).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('followerDeltaFromEngagement', () => {
  it('grows with likes and reposts', () => {
    const small = followerDeltaFromEngagement({ likes: 100, reposts: 10 })
    const big = followerDeltaFromEngagement({ likes: 10_000, reposts: 1000 })
    expect(big).toBeGreaterThan(small)
  })
})

describe('commentCountForPost', () => {
  it('stays within the 5-15 spec range', () => {
    const rng = mulberry32(7)
    for (let i = 0; i < 100; i++) {
      const count = commentCountForPost(rng, randomSocialScore(rng))
      expect(count).toBeGreaterThanOrEqual(5)
      expect(count).toBeLessThanOrEqual(15)
    }
  })
})

function randomSocialScore(rng: () => number) {
  return Math.floor(rng() * 100)
}

describe('statDeltasForTags', () => {
  it('is deterministic for a given seed', () => {
    const a = statDeltasForTags(mulberry32(3), ['controversial'])
    const b = statDeltasForTags(mulberry32(3), ['controversial'])
    expect(a).toEqual(b)
  })

  it('controversial posts raise humor and lower aura/followers on average', () => {
    const rng = mulberry32(9)
    const deltas = statDeltasForTags(rng, ['controversial'])
    const humor = deltas.find((d) => d.target === 'humor')
    const aura = deltas.find((d) => d.target === 'aura')
    const followers = deltas.find((d) => d.type === 'followers')
    expect(humor?.delta).toBeGreaterThan(0)
    expect(aura?.delta).toBeLessThan(0)
    expect(followers?.delta).toBeLessThan(0)
  })

  it('falls back to a small baseline delta when no tags are detected', () => {
    const deltas = statDeltasForTags(mulberry32(4), [])
    expect(deltas.length).toBeGreaterThan(0)
  })

  it('sums deltas across multiple detected tags', () => {
    const single = statDeltasForTags(mulberry32(1), ['gratitude'])
    const combined = statDeltasForTags(mulberry32(1), ['gratitude', 'big_moment'])
    expect(combined.length).toBeGreaterThan(single.length)
  })
})
