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

import { extractTopics, lookupForMessage } from './wikiFacts'

describe('on-demand lookups', () => {
  it('pulls out the things worth looking up', () => {
    expect(extractTopics('Did you see Outer Banks season 4?')).toContain('Outer Banks')
    expect(extractTopics('what about "Glass Onion" though')).toContain('Glass Onion')
    expect(extractTopics('hey how are you')).toEqual([])
  })

  it('finds what a person is known for in their own article (live Wikipedia; skipped when offline)', async () => {
    const out = await lookupForMessage('I loved Outer Banks', 'Madelyn Cline')
    if (out) expect(out).toMatch(/Outer Banks/)
  })
})

describe('shared history', () => {
  it('counts every time together and keeps what actually happened', () => {
    const mk = (id: string, description: string, at: number, text: string) =>
      ({ id, description, participantIds: ['n1'], status: 'ended', startAt: 0, createdAt: at, turnCount: 2, tags: [], pendingChoices: [],
        messages: [{ id: 'm' + id, from: 'narrator', text, at, origin: 'ai' }], outcomeSummary: 'went well' }) as unknown as Activity
    const acts = Object.fromEntries([1, 2, 3, 4].map((i) => [`a${i}`, mk(`a${i}`, `Date number ${i}`, i, `They laughed all night on date ${i}`)]))
    const out = buildDossier(npc, { playerName: 'Tim', activities: acts, threads: {}, posts: {}, profiles: {}, worldStories: [] })
    expect(out).toContain('4 times')
    expect(out).toContain('Date number 4')
    expect(out).toContain('laughed all night on date 4')
  })
})
