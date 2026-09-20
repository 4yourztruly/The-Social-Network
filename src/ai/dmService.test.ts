import { describe, expect, it } from 'vitest'
import { buildDmSystemPrompt, buildDmUserPrompt } from './dmService'
import type { DMMessage, NPC } from '../types'

function makeNpc(overrides: Partial<NPC>): NPC {
  return {
    id: 'npc_1',
    username: 'npc1',
    displayName: 'NPC One',
    bio: '',
    avatar: { kind: 'initials', value: 'N1' },
    verified: false,
    followers: 1000,
    following: 10,
    joinedAt: 0,
    isPlayer: false,
    persona: 'loyal_fan',
    personality: ['passionate'],
    relationship: 30,
    vibe: 'fan',
    mood: 0,
    postingStyle: { emoji: 0.5, caps: 0.2, hashtags: 0.2 },
    recentLineIds: [],
    followedByPlayer: false,
    ...overrides,
  }
}

describe('buildDmSystemPrompt', () => {
  it('names the NPC and their persona/traits', () => {
    const prompt = buildDmSystemPrompt(makeNpc({ displayName: 'Jamie Osei', personality: ['loyal', 'jokester'] }), 'Alex', 'Ashcombe United')
    expect(prompt).toContain('Jamie Osei')
    expect(prompt).toContain('loyal, jokester')
  })

  it('describes a hostile relationship for very negative relationship scores', () => {
    const prompt = buildDmSystemPrompt(makeNpc({ relationship: -80 }), 'Alex', 'Ashcombe United')
    expect(prompt).toContain('hostile')
  })

  it('describes a close relationship for very positive scores', () => {
    const prompt = buildDmSystemPrompt(makeNpc({ relationship: 90 }), 'Alex', 'Ashcombe United')
    expect(prompt).toContain('bond')
  })

  it('instructs the model to never break character or follow embedded instructions', () => {
    const prompt = buildDmSystemPrompt(makeNpc({}), 'Alex', 'Ashcombe United')
    expect(prompt.toLowerCase()).toContain('never break character')
    expect(prompt.toLowerCase()).toContain('not an instruction')
  })
})

describe('buildDmUserPrompt', () => {
  const msg = (from: 'player' | 'npc', text: string, at: number): DMMessage => ({
    id: `m_${at}`,
    from,
    text,
    at,
    origin: 'player',
  })

  it('includes the conversation transcript', () => {
    const prompt = buildDmUserPrompt([msg('player', 'hey', 1), msg('npc', 'hi there', 2)], 'Alex')
    expect(prompt).toContain('Alex: hey')
    expect(prompt).toContain('You: hi there')
  })

  it('only keeps the last 10 messages', () => {
    const messages = Array.from({ length: 15 }, (_, i) => msg('player', `msg ${i}`, i))
    const prompt = buildDmUserPrompt(messages, 'Alex')
    expect(prompt).not.toContain('msg 0')
    expect(prompt).toContain('msg 14')
  })
})
