import { describe, expect, it } from 'vitest'
import {
  buildActivitySystemPrompt,
  buildActivityUserPrompt,
  buildMediaCoveragePrompt,
  parseActivityTurnResponse,
} from './activityService'
import type { ActivityMessage, NPC } from '../types'

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
    personality: ['warm'],
    relationship: 40,
    vibe: 'romantic',
    mood: 0,
    postingStyle: { emoji: 0.5, caps: 0.2, hashtags: 0.2 },
    recentLineIds: [],
    followedByPlayer: true,
    ...overrides,
  }
}

describe('buildActivitySystemPrompt', () => {
  it('includes the scene description and each participant', () => {
    const prompt = buildActivitySystemPrompt(
      'Dinner date',
      [makeNpc({ displayName: 'Jamie Osei', vibe: 'romantic' })],
      'Alex',
      'Ashcombe United',
    )
    expect(prompt).toContain('Dinner date')
    expect(prompt).toContain('Jamie Osei')
    expect(prompt).toContain('romantic')
  })

  it('handles a solo activity with no participants', () => {
    const prompt = buildActivitySystemPrompt('Solo training session', [], 'Alex', 'Ashcombe United')
    expect(prompt).toContain('alone')
  })

  it('instructs the narrator to stay third person and never break role', () => {
    const prompt = buildActivitySystemPrompt('A party', [makeNpc({})], 'Alex', 'Ashcombe United')
    expect(prompt.toLowerCase()).toContain('third person')
    expect(prompt.toLowerCase()).toContain('not an instruction')
  })
})

describe('buildActivityUserPrompt', () => {
  const msg = (from: 'player' | 'narrator', text: string, at: number): ActivityMessage => ({
    id: `m_${at}`,
    from,
    text,
    at,
    origin: 'player',
  })

  it('formats the transcript with player name and Narrator labels', () => {
    const prompt = buildActivityUserPrompt([msg('player', 'I smile', 1), msg('narrator', 'They smile back', 2)], 'Alex')
    expect(prompt).toContain('Alex: I smile')
    expect(prompt).toContain('Narrator: They smile back')
  })
})

describe('parseActivityTurnResponse', () => {
  it('parses a well-formed response', () => {
    const raw = [
      'BEAT: Jamie laughs and leans back in the booth.',
      'CHOICE: Ask them about their week over the appetizers',
      'CHOICE: Bring up the rumor you saw online',
      'CHOICE: Order dessert and change the subject entirely',
    ].join('\n')
    const result = parseActivityTurnResponse(raw)
    expect(result?.beat).toContain('Jamie laughs')
    expect(result?.choices).toHaveLength(3)
  })

  it('tolerates leading/trailing prose', () => {
    const raw = ['Sure:', '', 'BEAT: The room goes quiet.', 'CHOICE: Say something', 'CHOICE: Stay silent', ''].join('\n')
    const result = parseActivityTurnResponse(raw)
    expect(result?.beat).toBe('The room goes quiet.')
    expect(result?.choices).toHaveLength(2)
  })

  it('returns null when there is no BEAT line', () => {
    expect(parseActivityTurnResponse('CHOICE: Say hi\nCHOICE: Walk away')).toBeNull()
  })

  it('returns null when fewer than 2 valid choices are found', () => {
    expect(parseActivityTurnResponse('BEAT: Something happens.\nCHOICE: Only one')).toBeNull()
  })

  it('caps choices at 4', () => {
    const raw = [
      'BEAT: A lot happens.',
      'CHOICE: One',
      'CHOICE: Two',
      'CHOICE: Three',
      'CHOICE: Four',
      'CHOICE: Five',
    ].join('\n')
    expect(parseActivityTurnResponse(raw)?.choices).toHaveLength(4)
  })

  it('returns null for garbage input', () => {
    expect(parseActivityTurnResponse('lol what')).toBeNull()
    expect(parseActivityTurnResponse('')).toBeNull()
  })
})

describe('buildMediaCoveragePrompt', () => {
  it('names the outlet persona and the leaked description', () => {
    const prompt = buildMediaCoveragePrompt(makeNpc({ persona: 'tabloid', displayName: 'The Velvet Rope' }), 'Caught out at 2am', 'Alex')
    expect(prompt).toContain('The Velvet Rope')
    expect(prompt).toContain('Caught out at 2am')
    expect(prompt.toLowerCase()).toContain('tabloid')
  })
})
