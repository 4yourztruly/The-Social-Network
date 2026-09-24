import { describe, expect, it } from 'vitest'
import { buildDossier } from './npcMemory'
import { titleMatchesName, trimFacts } from './wikiFacts'
import type { Activity, NPC } from '../types'

const npc = { id: 'n1', displayName: 'Madelyn Cline', knowledge: 'An American actress known for Outer Banks.', relationship: 30 } as unknown as NPC

describe('wikiFacts helpers', () => {
  it('only accepts an article that is actually about the person', () => {
    expect(titleMatchesName('Madelyn Cline', 'Madelyn Cline')).toBe(true)
    expect(titleMatchesName('Kylian Mbappé', 'Kylian Mbappe')).toBe(true)
    expect(titleMatchesName('Madelyn Cline', 'Cline (surname)')).toBe(false)
    expect(titleMatchesName('Zzyzx Qwerty', 'Football')).toBe(false)
  })

  it('trims long extracts at a sentence', () => {
    const long = 'A sentence here. '.repeat(100)
    expect(trimFacts(long).length).toBeLessThanOrEqual(900)
    expect(trimFacts(long).endsWith('.')).toBe(true)
  })
})

describe('buildDossier', () => {
  it('carries the looked-up facts even with no game state', () => {
    expect(buildDossier(npc, null)).toContain('Outer Banks')
  })

  it('remembers activities done together so DMs and comments stay consistent', () => {
    const date: Activity = {
      id: 'a1', description: 'Dinner date at a rooftop restaurant', participantIds: ['n1'], status: 'ended', startAt: 0,
      createdAt: 1, messages: [], turnCount: 3, tags: ['date'], pendingChoices: [], outcomeSummary: 'it went really well and they kissed goodnight',
    }
    const out = buildDossier(npc, {
      playerName: 'Tim', activities: { a1: date }, threads: {}, posts: {}, profiles: {},
      worldStories: [{ id: 's', day: 2, text: 'TMZ spotted Tim and Madelyn at dinner', people: ['n1', 'player'] }],
    })
    expect(out).toContain('Dinner date at a rooftop restaurant')
    expect(out).toContain('went really well')
    expect(out).toContain('TMZ spotted')
  })
})
