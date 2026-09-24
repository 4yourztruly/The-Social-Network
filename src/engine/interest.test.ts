import { describe, expect, it } from 'vitest'
import { clubIn, clubOf, reactionStance } from './interest'
import type { NPC } from '../types'

const npc = (over: Partial<NPC>) => ({ id: 'x', persona: 'celebrity', personality: [], relationship: 0, bio: '', ...over }) as unknown as NPC

const lamine = npc({ id: 'lamine', displayName: 'Lamine Yamal', knowledge: 'Lamine Yamal is a Spanish professional footballer who plays as a winger for La Liga club Barcelona and the Spain national team.' })
const mbappe = npc({ id: 'mbappe', displayName: 'Kylian Mbappé', knowledge: 'Kylian Mbappé is a French professional footballer who plays as a forward for La Liga club Real Madrid.' })
const actress = npc({ id: 'mad', displayName: 'Madelyn Cline', knowledge: 'Madelyn Cline is an American actress and model best known for Outer Banks.' })
const messi = npc({ id: 'messi', displayName: 'Lionel Messi', knowledge: 'Lionel Messi is an Argentine professional footballer who plays for Inter Miami and captains Argentina.' })

describe('who reacts to "Hala Madrid"', () => {
  const post = 'Hala Madrid!! What a night at the Bernabéu'

  it('recognises the club and who plays for whom', () => {
    expect(clubIn(post)?.key).toBe('real_madrid')
    expect(clubOf(lamine)?.key).toBe('barcelona')
    expect(clubOf(mbappe)?.key).toBe('real_madrid')
  })

  it('a rival winds it up, an insider cheers, a bystander nods, a non-football celeb stays out', () => {
    expect(reactionStance(lamine, post)).toBe('rival')
    expect(reactionStance(mbappe, post)).toBe('fan')
    expect(reactionStance(messi, post)).toBe('neutral')
    expect(reactionStance(actress, post)).toBe('skip')
  })

  it('a football post from a friend is not something an actress joins in on', () => {
    expect(reactionStance(actress, 'Great goal in the derby today')).toBe('skip')
  })
})
