import { inputRegex, pasteRegex } from '@tiptap/extension-code'
import { describe, expect, it } from 'vitest'

describe('extension-code input rule regex', () => {
  describe('inputRegex', () => {
    it('matches a single word wrapped in backticks', () => {
      expect('`code`').toMatch(inputRegex)
    })

    it('matches multiple words wrapped in backticks', () => {
      expect('`some code`').toMatch(inputRegex)
    })

    it('matches code preceded by a space', () => {
      expect('text `code`').toMatch(inputRegex)
    })

    it('matches code preceded by a non-backtick character', () => {
      expect('a`code`').toMatch(inputRegex)
    })

    it('matches code preceded by punctuation', () => {
      expect('!`code`').toMatch(inputRegex)
    })

    it('does NOT match triple backticks (code block)', () => {
      // Leading backtick before the opening backtick prevents matching
      expect('``code``').not.toMatch(inputRegex)
    })

    it('does NOT match when preceding character is a backtick', () => {
      // The regex requires the char before the opening backtick to NOT be a backtick
      expect('``code`').not.toMatch(inputRegex)
    })

    it('does NOT match when there is a backtick immediately after the closing backtick', () => {
      // Negative lookahead (?!`) prevents matching
      expect('`code``').not.toMatch(inputRegex)
    })

    it('does NOT match empty backticks', () => {
      expect('``').not.toMatch(inputRegex)
    })

    it('does NOT match a lone backtick', () => {
      expect('`').not.toMatch(inputRegex)
    })

    it('does NOT match when interior contains a backtick', () => {
      // [^`]+ in the middle means no backticks allowed inside
      expect('`co`de`').not.toMatch(inputRegex)
    })

    it('captures the inner text (capture group 2)', () => {
      const match = '`hello`'.match(inputRegex)

      expect(match).not.toBeNull()
      expect(match![2]).toBe('hello')
    })

    it('captures the inner text when preceded by a space', () => {
      const match = 'text `world`'.match(inputRegex)

      expect(match).not.toBeNull()
      expect(match![2]).toBe('world')
    })

    it('captures multi-word inner text', () => {
      const match = '`foo bar baz`'.match(inputRegex)

      expect(match).not.toBeNull()
      expect(match![2]).toBe('foo bar baz')
    })
  })

  describe('pasteRegex', () => {
    it('matches a single word wrapped in backticks', () => {
      expect('`code`').toMatch(pasteRegex)
    })

    it('matches multiple words wrapped in backticks', () => {
      expect('`some code`').toMatch(pasteRegex)
    })

    it('matches code preceded by a space', () => {
      expect('text `code`').toMatch(pasteRegex)
    })

    it('matches code in the middle of a longer text', () => {
      expect('hello `world` foo').toMatch(pasteRegex)
    })

    it('matches multiple code snippets in a single string (global flag)', () => {
      const str = '`one` and `two`'
      const matches = [...str.matchAll(pasteRegex)]

      expect(matches).toHaveLength(2)
      expect(matches[0]![2]).toBe('one')
      expect(matches[1]![2]).toBe('two')
    })

    it('does NOT match empty backticks', () => {
      expect('``').not.toMatch(pasteRegex)
    })

    it('does NOT match when preceding character is a backtick', () => {
      expect('``code`').not.toMatch(pasteRegex)
    })

    it('does NOT match when a backtick immediately follows the closing backtick', () => {
      expect('`code``').not.toMatch(pasteRegex)
    })

    it('does NOT match when interior contains a backtick', () => {
      // [^`]+ in the middle means no backticks allowed inside
      expect('`co`de`').not.toMatch(pasteRegex)
    })

    it('captures the inner text (capture group 2)', () => {
      const match = '`hello`'.match(pasteRegex)

      // matchAll is needed for global regex; use exec for first match
      const result = pasteRegex.exec('`hello`')
      // Reset lastIndex because regex is stateful with global flag
      pasteRegex.lastIndex = 0

      expect(result).not.toBeNull()
      expect(result![2]).toBe('hello')
    })
  })
})
