import { describe, expect, it } from 'vitest'
import { parseIdTextArray } from './batchService'

describe('parseIdTextArray', () => {
  it('reads a fenced JSON array with numeric or string ids', () => {
    const out = parseIdTextArray('Sure!\n```json\n[{"id":1,"text":"first"},{"id":"2","text":"\\"second\\""}]\n```')
    expect(out?.get('1')).toBe('first')
    expect(out?.get('2')).toBe('second')
  })

  it('returns null for junk', () => {
    expect(parseIdTextArray('no json here')).toBeNull()
    expect(parseIdTextArray('[{"nope":1}]')).toBeNull()
    expect(parseIdTextArray('[]')).toBeNull()
  })
})
