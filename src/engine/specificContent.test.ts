import { describe, expect, it } from 'vitest'
import { mulberry32 } from './rng'
import { acknowledgementPost, celebTopics, relatedComment, specificCelebPost } from './specificContent'
import type { NPC } from '../types'

const madelyn = {
  id: 'm', displayName: 'Madelyn Cline', bio: 'actress',
  knowledge:
    "Madelyn Renee Cline (born December 21, 1997) is an American actress and model. She is best known for her roles in the Netflix teen drama series Outer Banks (2020–2026), in Rian Johnson's mystery film Glass Onion: A Knives Out Mystery (2022), and in the slasher film I Know What You Did Last Summer (2025).",
} as unknown as NPC

describe('specific content', () => {
  it('pulls a celeb\'s real works out of their looked-up facts, not their own name', () => {
    const topics = celebTopics(madelyn)
    expect(topics).toContain('Outer Banks')
    expect(topics.some((t) => /Madelyn/.test(t))).toBe(false)
    expect(topics).not.toContain('American')
  })

  it('a celeb post is about a concrete thing, and a celeb with nothing specific stays silent', () => {
    const post = specificCelebPost(mulberry32(1), madelyn, [], {})
    expect(post).toBeTruthy()
    expect(celebTopics(madelyn).some((t) => post!.includes(t))).toBe(true)
    expect(specificCelebPost(mulberry32(1), { id: 'x', displayName: 'Nobody', bio: '' } as unknown as NPC, [], {})).toBeNull()
  })

  it('comments quote what the post is about', () => {
    const c = relatedComment(mulberry32(2), 'Rewatching Outer Banks tonight and it still gets me', 'Madelyn', 'loyal_fan')
    expect(c).toContain('Outer Banks')
    expect(relatedComment(mulberry32(2), 'hi', 'Madelyn', 'loyal_fan')).toBeNull()
  })

  it('acknowledgement posts @ the player', () => {
    expect(acknowledgementPost(mulberry32(3), 'reply', 'tim', 'x')).toContain('@tim')
  })
})
