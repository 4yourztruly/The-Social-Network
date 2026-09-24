import { describe, expect, it } from 'vitest'
import { mulberry32 } from './rng'
import { gossipCommentText, gossipFacts, gossipTone, shorten, tabloidPostText, thirdPerson, type GossipSubject } from './gossip'

const date: GossipSubject = {
  kind: 'activity',
  playerName: 'Alex Rivera',
  detail: 'Dinner date at a rooftop restaurant',
  tags: [],
  others: ['Zendaya'],
}

describe('gossipTone', () => {
  it('reads a dinner date as romantic and a party as wild', () => {
    expect(gossipTone(date)).toBe('romantic')
    expect(gossipTone({ ...date, detail: 'Big party at a club', others: [] })).toBe('wild')
    expect(gossipTone({ kind: 'event', playerName: 'A', detail: 'x', tags: [], others: [], eventTier: 'bad' })).toBe('negative')
  })
})

describe('tabloidPostText', () => {
  it('names the player, the other person and what actually happened for a date', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const text = tabloidPostText(mulberry32(seed), date)
      expect(text).toContain('Alex Rivera')
      expect(text).toContain('Zendaya')
      expect(text).toContain('Dinner date at a rooftop restaurant')
      expect(text).not.toMatch(/{w+}/)
    }
  })

  it('tells an event in third person with the players move and outcome', () => {
    const text = tabloidPostText(mulberry32(1), {
      kind: 'event',
      playerName: 'Alex Rivera',
      detail: 'A heckler yells something about you loud enough for everyone to hear.',
      tags: [],
      others: [],
      eventTier: 'bad',
      eventMove: 'Fire back a sharp one-liner',
    })
    expect(text).toContain('Alex Rivera')
    expect(text).not.toMatch(/you/i)
    expect(text).toContain('Fire back a sharp one-liner')
    expect(text).toContain('NOT go well')
  })

  it('quotes a post and never falls back to vague filler', () => {
    const text = tabloidPostText(mulberry32(3), { kind: 'post', playerName: 'Alex Rivera', detail: 'Scored twice tonight!', tags: ['win'], others: [] })
    expect(text).toContain('Scored twice tonight!')
    expect(text.toLowerCase()).not.toContain("won't believe")
  })
})

describe('gossipCommentText', () => {
  it('refers to who and what for every target, with or without another person', () => {
    const targets = ['tabloid', 'participant_post', 'player_post', 'unrelated'] as const
    for (const target of targets) {
      for (let seed = 1; seed <= 12; seed++) {
        const withOther = gossipCommentText(mulberry32(seed), date, target)
        expect(withOther).not.toMatch(/{w+}/)
        expect(withOther).toMatch(/Alex Rivera|Zendaya/)
        const solo = gossipCommentText(mulberry32(seed), { ...date, others: [] }, target)
        expect(solo).toContain('Alex Rivera')
      }
    }
  })
})

describe('helpers', () => {
  it('shortens on a word boundary and converts second person', () => {
    expect(shorten('a'.repeat(200), 20).length).toBeLessThanOrEqual(21)
    expect(thirdPerson('They ask you about your plans', 'Sam')).toBe("They ask Sam about Sam's plans")
    expect(gossipFacts(date)).toContain('Zendaya')
  })
})
