import { describe, expect, it } from 'vitest'
import { shortNameFor } from './shortName'

describe('shortNameFor', () => {
  it('returns the first name for a person', () => {
    expect(shortNameFor('Theo Lin')).toBe('Theo')
  })

  it('keeps the full name when it starts with a leading article', () => {
    expect(shortNameFor('The Green Room')).toBe('The Green Room')
    expect(shortNameFor('The Velvet Rope')).toBe('The Velvet Rope')
  })

  it('returns single-word names unchanged', () => {
    expect(shortNameFor('Madonna')).toBe('Madonna')
  })
})
