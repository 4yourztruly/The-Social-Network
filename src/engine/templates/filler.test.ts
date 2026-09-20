import { describe, expect, it } from 'vitest'
import { fillTemplate } from './filler'

describe('fillTemplate', () => {
  it('replaces a single variable', () => {
    expect(fillTemplate('{goals} goals?!', { goals: 2 })).toBe('2 goals?!')
  })

  it('replaces multiple variables', () => {
    expect(fillTemplate('{goals} vs {opponent}', { goals: 3, opponent: 'Duncastle' })).toBe(
      '3 vs Duncastle',
    )
  })

  it('leaves an unmatched placeholder untouched', () => {
    expect(fillTemplate('{unknown} thing', {})).toBe('{unknown} thing')
  })

  it('leaves plain text without placeholders untouched', () => {
    expect(fillTemplate('no placeholders here', { x: 1 })).toBe('no placeholders here')
  })
})
