import { describe, expect, it } from 'vitest'
import { extractJSON, extractJSONArray, parseJSON } from './ai.js'

// ─── extractJSON ─────────────────────────────────────────────────────────────

describe('extractJSON', () => {
  it('parses plain JSON with no fence', () => {
    const input = '{"name":"test","value":1}'
    expect(extractJSON(input)).toBe('{"name":"test","value":1}')
  })

  it('strips ```json fences', () => {
    const input = '```json\n{"name":"test"}\n```'
    expect(extractJSON(input)).toBe('{"name":"test"}')
  })

  it('strips plain ``` fences', () => {
    const input = '```\n{"name":"test"}\n```'
    expect(extractJSON(input)).toBe('{"name":"test"}')
  })

  it('extracts JSON from surrounding prose', () => {
    const input = 'Here is the result: {"name":"test","value":42} — done.'
    expect(extractJSON(input)).toBe('{"name":"test","value":42}')
  })

  it('handles nested JSON objects', () => {
    const input = '{"outer":{"inner":{"deep":true}}}'
    const result = extractJSON(input)
    expect(JSON.parse(result)).toEqual({ outer: { inner: { deep: true } } })
  })

  it('handles JSON with arrays as values', () => {
    const input = '{"keywords":["a","b","c"],"name":"test"}'
    const result = extractJSON(input)
    expect(JSON.parse(result)).toEqual({ keywords: ['a', 'b', 'c'], name: 'test' })
  })

  it('throws when no JSON object is found', () => {
    expect(() => extractJSON('no json here')).toThrow('No JSON object found in response')
  })

  it('throws when input is an array not an object', () => {
    expect(() => extractJSON('[1,2,3]')).toThrow('No JSON object found in response')
  })
})

// ─── extractJSONArray ─────────────────────────────────────────────────────────

describe('extractJSONArray', () => {
  it('parses plain JSON array with no fence', () => {
    const input = '[{"name":"a"},{"name":"b"}]'
    expect(extractJSONArray(input)).toBe('[{"name":"a"},{"name":"b"}]')
  })

  it('strips ```json fences', () => {
    const input = '```json\n[{"name":"a"}]\n```'
    expect(extractJSONArray(input)).toBe('[{"name":"a"}]')
  })

  it('extracts array from surrounding prose', () => {
    const input = 'Results: [{"name":"a"},{"name":"b"}] — end.'
    expect(extractJSONArray(input)).toBe('[{"name":"a"},{"name":"b"}]')
  })

  it('handles nested arrays and objects', () => {
    const input = '[{"keywords":["x","y"],"topics":["z"]}]'
    const result = extractJSONArray(input)
    expect(JSON.parse(result)).toEqual([{ keywords: ['x', 'y'], topics: ['z'] }])
  })

  it('throws when no JSON array is found', () => {
    expect(() => extractJSONArray('no array here')).toThrow('No JSON array found in response')
  })

  it('throws when input is an object not an array', () => {
    expect(() => extractJSONArray('{"key":"value"}')).toThrow('No JSON array found in response')
  })
})

// ─── parseJSON ───────────────────────────────────────────────────────────────

describe('parseJSON', () => {
  it('parses valid JSON', () => {
    expect(parseJSON<{ ok: boolean }>('{"ok":true}')).toEqual({ ok: true })
  })

  it('parses valid JSON array', () => {
    expect(parseJSON<number[]>('[1,2,3]')).toEqual([1, 2, 3])
  })

  it('throws a clear error for invalid JSON', () => {
    expect(() => parseJSON('not json')).toThrow('Failed to parse AI response as JSON')
  })

  it('includes context in the error message', () => {
    expect(() => parseJSON('bad', 'OpenAI interest response')).toThrow(
      'Failed to parse OpenAI interest response as JSON',
    )
  })

  it('truncates long invalid responses in the error message', () => {
    const longBad = 'x'.repeat(300)
    const err = (() => {
      try { parseJSON(longBad); return null }
      catch (e) { return e as Error }
    })()
    expect(err).not.toBeNull()
    expect(err!.message).toContain('…')
    expect(err!.message.length).toBeLessThan(400)
  })

  it('does not silently corrupt data on partial JSON', () => {
    expect(() => parseJSON('{"name":"ok","keywords":[1,2')).toThrow()
  })
})
