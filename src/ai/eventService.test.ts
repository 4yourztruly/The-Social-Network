import { describe, expect, it } from 'vitest'
import { buildEncounterPrompt, parseEncounterResponse } from './eventService'
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
    persona: 'loyal_fan',
    personality: [],
    relationship: 40,
    vibe: 'friend',
    mood: 0,
    postingStyle: { emoji: 0, caps: 0, hashtags: 0 },
    recentLineIds: [],
    followedByPlayer: true,
    ...overrides,
  }
}

function makeActivity(summary: string): ActivityLogEntry {
  return { id: `log_${summary}`, at: 1, action: 'post', deltas: [], summary }
}

describe('buildEncounterPrompt', () => {
  it('includes recent activity when present', () => {
    const prompt = buildEncounterPrompt('Alex', 'Ashcombe United', [makeActivity('Posted: "big win"')], null)
    expect(prompt).toContain('big win')
  })

  it('tells the model to invent something when there is no history', () => {
    const prompt = buildEncounterPrompt('Alex', 'Ashcombe United', [], null)
    expect(prompt.toLowerCase()).toContain('invent')
  })

  it('names the celeb when one is available', () => {
    const prompt = buildEncounterPrompt('Alex', 'Ashcombe United', [], makeNpc({ displayName: 'Mia Torres' }))
    expect(prompt).toContain('Mia Torres')
  })

  it('says to keep it solo when no celeb is available', () => {
    const prompt = buildEncounterPrompt('Alex', 'Ashcombe United', [], null)
    expect(prompt.toLowerCase()).toContain('solo')
  })

  it('specifies the SITUATION/CHOICE response format', () => {
    const prompt = buildEncounterPrompt('Alex', 'Ashcombe United', [], null)
    expect(prompt).toContain('SITUATION:')
    expect(prompt).toContain('CHOICE:')
  })
})

describe('parseEncounterResponse', () => {
  it('parses a well-formed response', () => {
    const raw = [
      'SITUATION: A rival calls you out in a post-match interview.',
      'CHOICE: Fire back | bold',
      'CHOICE: Stay classy | safe',
      'CHOICE: Deflect with a joke | safe',
    ].join('\n')
    const result = parseEncounterResponse(raw)
    expect(result).not.toBeNull()
    expect(result?.text).toContain('rival calls you out')
    expect(result?.choices).toHaveLength(3)
    expect(result?.choices[0]).toEqual({ id: 'ai_0', label: 'Fire back', risk: 'bold' })
    expect(result?.choices[1].risk).toBe('safe')
  })

  it('tolerates leading/trailing prose around the format', () => {
    const raw = [
      'Sure, here you go:',
      '',
      'SITUATION: Someone leaks a screenshot of your DMs.',
      'CHOICE: Address it head-on | bold',
      'CHOICE: Say nothing | safe',
      '',
      'Hope that helps!',
    ].join('\n')
    const result = parseEncounterResponse(raw)
    expect(result?.text).toContain('leaks a screenshot')
    expect(result?.choices).toHaveLength(2)
  })

  it('defaults risk to safe when missing or unrecognized', () => {
    const raw = ['SITUATION: A stranger recognizes you at the airport.', 'CHOICE: Say hi', 'CHOICE: Keep walking | chill'].join('\n')
    const result = parseEncounterResponse(raw)
    expect(result?.choices.every((c) => c.risk === 'safe')).toBe(true)
  })

  it('returns null when there is no SITUATION line', () => {
    expect(parseEncounterResponse('CHOICE: Say hi | safe\nCHOICE: Walk away | bold')).toBeNull()
  })

  it('returns null when fewer than 2 valid choices are found', () => {
    const raw = 'SITUATION: Something happens.\nCHOICE: Only one option | safe'
    expect(parseEncounterResponse(raw)).toBeNull()
  })

  it('caps choices at 4 even if the model rambles on', () => {
    const raw = [
      'SITUATION: A big moment.',
      'CHOICE: One | safe',
      'CHOICE: Two | bold',
      'CHOICE: Three | safe',
      'CHOICE: Four | bold',
      'CHOICE: Five | safe',
    ].join('\n')
    expect(parseEncounterResponse(raw)?.choices).toHaveLength(4)
  })

  it('returns null for garbage input', () => {
    expect(parseEncounterResponse('lol what')).toBeNull()
    expect(parseEncounterResponse('')).toBeNull()
  })
})
