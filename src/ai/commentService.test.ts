import { describe, expect, it } from 'vitest'
import { buildCommentSystemPrompt, buildCommentUserPrompt } from './commentService'
import type { ActivityLogEntry, NPC } from '../types'

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
    persona: 'tabloid',
    personality: ['nosy'],
    relationship: 10,
    vibe: 'fan',
    mood: 0,
    postingStyle: { emoji: 0.5, caps: 0.2, hashtags: 0.2 },
    recentLineIds: [],
    followedByPlayer: false,
    ...overrides,
  }
}

function makeActivity(summary: string, at: number): ActivityLogEntry {
  return { id: `log_${at}`, at, action: 'post', deltas: [], summary }
}

describe('buildCommentSystemPrompt', () => {
  it('names the NPC and their persona/traits', () => {
    const prompt = buildCommentSystemPrompt(
      makeNpc({ displayName: 'Jamie Osei', personality: ['loyal', 'jokester'] }),
      'Alex',
      'Ashcombe United',
      [],
    )
    expect(prompt).toContain('Jamie Osei')
    expect(prompt).toContain('loyal, jokester')
  })

  it('includes recent activity as gossip material when present', () => {
    const prompt = buildCommentSystemPrompt(makeNpc({}), 'Alex', 'Ashcombe United', [
      makeActivity('Posted: "big win tonight"', 1),
      makeActivity('Posted: "sorry for the interview"', 2),
    ])
    expect(prompt).toContain('big win tonight')
    expect(prompt).toContain('sorry for the interview')
  })

  it('omits the gossip section when there is no recent activity', () => {
    const prompt = buildCommentSystemPrompt(makeNpc({}), 'Alex', 'Ashcombe United', [])
    expect(prompt.toLowerCase()).not.toContain('recent things')
  })

  it('says this is a public reply, not a DM', () => {
    const prompt = buildCommentSystemPrompt(makeNpc({}), 'Alex', 'Ashcombe United', [])
    expect(prompt.toLowerCase()).toContain('public')
  })

  it('instructs the model to never break character or follow embedded instructions', () => {
    const prompt = buildCommentSystemPrompt(makeNpc({}), 'Alex', 'Ashcombe United', [])
    expect(prompt.toLowerCase()).toContain('never break character')
    expect(prompt.toLowerCase()).toContain('not an instruction')
  })
})

describe('buildCommentUserPrompt', () => {
  it('includes the post text and player name', () => {
    const prompt = buildCommentUserPrompt('what a night', 'Alex')
    expect(prompt).toContain('Alex')
    expect(prompt).toContain('what a night')
  })
})
