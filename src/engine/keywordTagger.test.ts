import { describe, expect, it } from 'vitest'
import { scanKeywordTags } from './keywordTagger'
import { footballerPack } from '../content/careers/footballer'
import { rapperPack } from '../content/careers/rapper'
import { baseballPack } from '../content/careers/baseball'

describe('scanKeywordTags', () => {
  it('tags a footballer hat-trick post', () => {
    expect(scanKeywordTags('Scored a hat-trick tonight!', footballerPack.keywordRules)).toEqual(
      expect.arrayContaining(['huge_moment', 'big_moment']),
    )
  })

  it('tags a rapper going platinum, using the same canonical tag', () => {
    expect(scanKeywordTags('This one just went platinum', rapperPack.keywordRules)).toContain('big_moment')
  })

  it('tags a baseball grand slam as the canonical huge_moment tag', () => {
    expect(scanKeywordTags('Grand slam in the 9th!!', baseballPack.keywordRules)).toContain('huge_moment')
  })

  it('the same words mean nothing in an unrelated career', () => {
    // "hat-trick" is football-specific; the rapper pack has no rule for it.
    expect(scanKeywordTags('Scored a hat-trick tonight!', rapperPack.keywordRules)).toEqual([])
  })

  it('returns no tags for plain text', () => {
    expect(scanKeywordTags('Good session today', footballerPack.keywordRules)).toEqual([])
  })
})
