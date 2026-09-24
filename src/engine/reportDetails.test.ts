import { describe, expect, it } from 'vitest'
import { explainStatDeltas, relationshipLabel, tagPhrase } from './reportDetails'

describe('explainStatDeltas', () => {
  it('sums each stat and names the signals that drove it', () => {
    const reasons = explainStatDeltas(
      ['win', 'gratitude'],
      [
        { type: 'stat', target: 'aura', delta: 3 },
        { type: 'stat', target: 'aura', delta: 3 },
      ],
      'post',
      'Likes pulled in followers.',
      16,
    )
    const aura = reasons.find((r) => r.stat === 'aura')
    expect(aura?.delta).toBe(6)
    expect(aura?.reason).toContain('a win')
    expect(aura?.reason).toContain('gratitude')
    expect(reasons.find((r) => r.stat === 'followers')?.reason).toBe('Likes pulled in followers.')
  })

  it('explains a plain post as the small baseline, and event outcomes by tier', () => {
    const plain = explainStatDeltas([], [{ type: 'stat', target: 'humor', delta: 1 }], 'post')
    expect(plain[0].reason).toContain('baseline')
    const bad = explainStatDeltas(['controversial'], [{ type: 'stat', target: 'aura', delta: -5 }], 'event', undefined, 0, { tier: 'bad' })
    expect(bad[0].reason).toContain('badly')
  })
})

describe('labels', () => {
  it('maps relationship values to words and tags to phrases', () => {
    expect(relationshipLabel(0)).toBe('Neutral')
    expect(relationshipLabel(13)).toBe('Friendly')
    expect(relationshipLabel(-70)).toBe('Enemies')
    expect(tagPhrase('big_moment')).toBe('a big moment')
    expect(tagPhrase('some_new_tag')).toBe('some new tag')
  })
})
