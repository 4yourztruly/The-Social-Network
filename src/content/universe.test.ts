import { describe, expect, it } from 'vitest'
import { mulberry32 } from '../engine/rng'
import { buildCelebSeed, buildFixedMediaSeeds, FIXED_MEDIA, personalityFromDescription } from './universe'
import { tierForPersona } from '../engine/npcTier'

describe('fixed media', () => {
  it('always yields CNN, Sky Sports and TMZ, with news/tabloid personas', () => {
    const seeds = buildFixedMediaSeeds(mulberry32(1))
    expect(seeds.map((s) => s.displayName)).toEqual(['CNN', 'Sky Sports', 'TMZ'])
    expect(seeds.find((s) => s.displayName === 'TMZ')?.persona).toBe('tabloid')
    expect(seeds.filter((s) => s.persona === 'match_reporter')).toHaveLength(2)
    expect(FIXED_MEDIA.every((m) => tierForPersona(m.persona) === 'media')).toBe(true)
  })
})

describe('buildCelebSeed', () => {
  it('makes a roleless, career-agnostic celebrity with or without a description', () => {
    const used = new Set<string>()
    const withDesc = buildCelebSeed({ name: 'Taylor Swift', description: 'funny and chaotic, loves cats' }, null, mulberry32(1), used)
    const without = buildCelebSeed({ name: 'Taylor Swift' }, null, mulberry32(2), used)
    for (const seed of [withDesc, without]) {
      expect(seed.persona).toBe('celebrity')
      expect(seed.offTopic).toBe(true)
      expect(tierForPersona(seed.persona)).toBe('celeb')
    }
    expect(withDesc.personality).toEqual(expect.arrayContaining(['funny', 'chaotic']))
    expect(without.bio).toBe('')
    expect(without.username).not.toBe(withDesc.username) // deduped
  })

  it('prefers AI-researched details when provided', () => {
    const seed = buildCelebSeed(
      { name: 'Kylian Mbappé' },
      { bio: 'Footballer.', personality: ['french', 'competitive'], followers: 9_000_000, verified: true, avatarUrl: 'https://x/y.jpg' },
      mulberry32(3),
      new Set(),
    )
    expect(seed.followers).toBe(9_000_000)
    expect(seed.personality).toEqual(['french', 'competitive'])
    expect(seed.avatar).toEqual({ kind: 'webp', value: 'https://x/y.jpg' })
  })

  it('extracts known trait words from a description', () => {
    expect(personalityFromDescription('Very sarcastic and a bit shy')).toEqual(['sarcastic', 'shy'])
    expect(personalityFromDescription('')).toEqual([])
  })
})
