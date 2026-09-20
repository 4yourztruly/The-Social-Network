import { describe, expect, it } from 'vitest'
import { buildUsernameIndex, extractMentionedIds } from './mentions'

describe('buildUsernameIndex + extractMentionedIds', () => {
  const profiles = {
    p1: { id: 'p1', username: 'JamieOsei9' },
    p2: { id: 'p2', username: 'lucaferreira' },
  }
  const index = buildUsernameIndex(profiles)

  it('resolves a mention case-insensitively', () => {
    expect(extractMentionedIds('great game @jamieosei9!', index)).toEqual(['p1'])
  })

  it('resolves multiple distinct mentions', () => {
    expect(extractMentionedIds('@JamieOsei9 and @lucaferreira were unreal', index)).toEqual(['p1', 'p2'])
  })

  it('dedupes repeated mentions of the same user', () => {
    expect(extractMentionedIds('@jamieosei9 @jamieosei9', index)).toEqual(['p1'])
  })

  it('drops mentions of unknown usernames', () => {
    expect(extractMentionedIds('shoutout @nobody', index)).toEqual([])
  })

  it('returns an empty array for text with no mentions', () => {
    expect(extractMentionedIds('no mentions here', index)).toEqual([])
  })
})
