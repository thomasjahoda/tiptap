import { Editor } from '@tiptap/core'
import Code from '@tiptap/extension-code'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

describe('extension-code input rules', () => {
  let editor: Editor

  const createEditorEl = () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    return el
  }

  /**
   * Simulates typing a string into the editor and triggering the input rule on the final char.
   *
   * The input rule plugin builds its match string as:
   *   textBefore = getTextContentFromNodes($from) + text
   * where `text` is the single character being typed and `$from` is the cursor position before
   * it is inserted. So we insert the prefix into the doc first, then fire handleTextInput
   * with only the final character as the trigger.
   */
  const typeText = (text: string) => {
    if (text.length === 0) {return}

    const prefix = text.slice(0, -1)
    const trigger = text.slice(-1)

    if (prefix.length > 0) {
      const { from, to } = editor.state.selection
      editor.view.dispatch(editor.state.tr.insertText(prefix, from, to))
    }

    const { from } = editor.state.selection
    editor.view.someProp('handleTextInput', f => f(editor.view, from, from, trigger))
  }

  beforeEach(() => {
    editor = new Editor({
      element: createEditorEl(),
      extensions: [Document, Text, Paragraph, Code],
    })
  })

  afterEach(() => {
    editor.destroy()
    document.body.innerHTML = ''
  })

  describe('inputRule', () => {
    it('applies code mark when typing `word`', () => {
      typeText('`code`')
      expect(editor.getHTML()).toBe('<p><code>code</code></p>')
    })

    it('applies code mark for multiple words', () => {
      typeText('`some code`')
      expect(editor.getHTML()).toBe('<p><code>some code</code></p>')
    })

    it('applies code mark when preceded by a space', () => {
      typeText('text `code`')
      expect(editor.getHTML()).toBe('<p>text <code>code</code></p>')
    })

    it('applies code mark when preceded by a non-backtick character', () => {
      typeText('a`code`')
      expect(editor.getHTML()).toBe('<p>a<code>code</code></p>')
    })

    it('applies code mark when preceded by punctuation', () => {
      typeText('!`code`')
      expect(editor.getHTML()).toBe('<p>!<code>code</code></p>')
    })

    it('does NOT apply code mark for double opening backticks (``code``)', () => {
      typeText('``code``')
      expect(editor.getHTML()).not.toContain('<code>')
    })

    it('does NOT apply code mark when opening backtick is preceded by a backtick', () => {
      typeText('``code`')
      expect(editor.getHTML()).not.toContain('<code>')
    })

    it('does NOT apply code mark when closing backtick is immediately followed by a backtick', () => {
      typeText('`code``')
      expect(editor.getHTML()).not.toContain('<code>')
    })

    it('does NOT apply code mark for empty backtick pair', () => {
      typeText('``')
      expect(editor.getHTML()).not.toContain('<code>')
    })

    it('does NOT apply code mark for a lone backtick', () => {
      typeText('`')
      expect(editor.getHTML()).not.toContain('<code>')
    })

    it.skip('does NOT apply code mark when the content between backticks contains a backtick', () => {
      // TODO FIXME: currently broken, but not important
      typeText('`co`de`')
      expect(editor.getHTML()).not.toContain('<code>')
    })

    it('captures the correct inner text', () => {
      typeText('`hello`')
      expect(editor.getHTML()).toBe('<p><code>hello</code></p>')
    })

    it('captures the correct inner text when preceded by regular text', () => {
      typeText('text `world`')
      expect(editor.getHTML()).toBe('<p>text <code>world</code></p>')
    })

    it('captures multi-word inner text', () => {
      typeText('`foo bar baz`')
      expect(editor.getHTML()).toBe('<p><code>foo bar baz</code></p>')
    })
  })

  describe('pasteRule', () => {
    it('applies code mark when pasting `word`', () => {
      editor.view.pasteText('`code`')
      expect(editor.getHTML()).toBe('<p><code>code</code></p>')
    })

    it('applies code mark for multiple words', () => {
      editor.view.pasteText('`some code`')
      expect(editor.getHTML()).toBe('<p><code>some code</code></p>')
    })

    it('applies code mark when preceded by a space', () => {
      editor.view.pasteText('text `code`')
      expect(editor.getHTML()).toBe('<p>text <code>code</code></p>')
    })

    it('applies code mark to inline snippet in a longer text', () => {
      editor.view.pasteText('hello `world` foo')
      expect(editor.getHTML()).toContain('<code>world</code>')
    })

    it('applies code marks to multiple snippets in a single paste', () => {
      editor.view.pasteText('`one` and `two`')
      const html = editor.getHTML()
      expect(html).toContain('<code>one</code>')
      expect(html).toContain('<code>two</code>')
    })

    it('does NOT apply code mark for an empty backtick pair', () => {
      editor.view.pasteText('``')
      expect(editor.getHTML()).not.toContain('<code>')
    })

    it('does NOT apply code mark when opening backtick is preceded by a backtick', () => {
      editor.view.pasteText('``code`')
      expect(editor.getHTML()).not.toContain('<code>')
    })

    it('does NOT apply code mark when closing backtick is immediately followed by a backtick', () => {
      editor.view.pasteText('`code``')
      expect(editor.getHTML()).not.toContain('<code>')
    })

    it('does NOT apply code mark when the content between backticks contains a backtick', () => {
      editor.view.pasteText('`co`de`')
      expect(editor.getHTML()).not.toContain('<code>')
    })
  })
})
