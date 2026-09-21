import { describe, expect, it } from 'vitest'
import { inferPersonaFromBio } from './personaInference'

describe('inferPersonaFromBio', () => {
  it('matches a tabloid account from its bio', () => {
    expect(inferPersonaFromBio('TMZ', 'Tabloid celeb news')).toBe('tabloid')
  })

  it('matches a reporter from its bio', () => {
    expect(inferPersonaFromBio('Sam Reid', 'Sports journalist covering the league')).toBe('match_reporter')
  })

  it('matches a coach from its bio', () => {
    expect(inferPersonaFromBio('Coach Rivera', 'Their trainer and mentor')).toBe('coach')
  })

  it('matches keywords in the name when the bio is empty', () => {
    expect(inferPersonaFromBio('Gossip Girl', '')).toBe('tabloid')
  })

  it('falls back to loyal_fan when nothing matches', () => {
    expect(inferPersonaFromBio('Jamie', 'My best friend from school')).toBe('loyal_fan')
  })

  it('is case-insensitive', () => {
    expect(inferPersonaFromBio('TABLOID DAILY', '')).toBe('tabloid')
  })
})
