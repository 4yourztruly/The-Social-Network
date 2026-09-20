import { describe, expect, it } from 'vitest'
import { extractOrgFromBio, extractRoleFromBio, inferCareerFromBio } from './careerInference'

describe('inferCareerFromBio', () => {
  it('infers footballer from football-flavored text', () => {
    expect(inferCareerFromBio('Striker for my club, dreaming of the Premier League')).toBe('footballer')
  })

  it('infers rapper from hip-hop-flavored text', () => {
    expect(inferCareerFromBio('Independent rapper, just dropped a new mixtape with fire bars')).toBe('rapper')
  })

  it('infers singer from pop-flavored text', () => {
    expect(inferCareerFromBio('Pop vocalist working on my debut album and tour')).toBe('singer')
  })

  it('infers baseball_player from baseball-flavored text', () => {
    expect(inferCareerFromBio('Starting pitcher, live for the bullpen and the diamond')).toBe('baseball_player')
  })

  it('falls back to a deterministic default for ambiguous text', () => {
    expect(inferCareerFromBio('just living my life')).toBe('footballer')
    expect(inferCareerFromBio('')).toBe('footballer')
  })

  it('is case-insensitive', () => {
    expect(inferCareerFromBio('STRIKER FOR MY CLUB IN THE PREMIER LEAGUE')).toBe('footballer')
  })
})

describe('extractRoleFromBio', () => {
  it('extracts a specific compound role over the generic term', () => {
    expect(extractRoleFromBio('Right winger for Real Madrid', 'footballer')).toBe('Right Winger')
  })

  it('extracts a rapper role', () => {
    expect(extractRoleFromBio('MC and producer out of the East Side', 'rapper')).toBe('MC')
  })

  it('returns null — never a made-up default — when nothing matches', () => {
    expect(extractRoleFromBio('just vibing today', 'footballer')).toBeNull()
  })
})

describe('extractOrgFromBio', () => {
  it('extracts a capitalized org name after "for"', () => {
    expect(extractOrgFromBio('Right winger for Real Madrid and Sweden national team')).toBe('Real Madrid')
  })

  it('extracts an org typed all-lowercase, same as the user wrote it', () => {
    expect(extractOrgFromBio('right winger for real madrid and swedens national team')).toBe('Real Madrid')
  })

  it('extracts an org after "at"', () => {
    expect(extractOrgFromBio('Producer at Nightfall Records')).toBe('Nightfall Records')
  })

  it('returns null when no org-introducing preposition is present', () => {
    expect(extractOrgFromBio('just a striker chasing goals')).toBeNull()
  })

  it('does not invent an org from ordinary sentence continuation', () => {
    expect(extractOrgFromBio('playing for fun this weekend')).toBeNull()
    expect(extractOrgFromBio('training with the team today')).toBeNull()
  })
})
