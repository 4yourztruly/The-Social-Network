import { describe, expect, it } from 'vitest'
import { funMarkerTags } from './funMarkers'

describe('funMarkerTags', () => {
  it('detects humor markers', () => {
    expect(funMarkerTags('lmaooo I cannot 💀')).toContain('funny')
    expect(funMarkerTags('that was hilarious lol')).toContain('funny')
    expect(funMarkerTags('lmaoooooo dead')).toContain('funny')
  })

  it('detects aura markers', () => {
    expect(funMarkerTags('built different fr, no cap')).toContain('aura_moment')
    expect(funMarkerTags('that entrance was iconic')).toContain('aura_moment')
  })

  it('returns both when both are present', () => {
    const tags = funMarkerTags('lol no cap that was funny and iconic')
    expect(tags).toContain('funny')
    expect(tags).toContain('aura_moment')
  })

  it('returns neither for plain text', () => {
    expect(funMarkerTags('Great win today, proud of the team.')).toEqual([])
  })
})
