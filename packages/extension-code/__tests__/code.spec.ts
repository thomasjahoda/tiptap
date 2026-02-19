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
   * Simulates typing a string of text into the editor, exactly as if the user typed it.
   *
   * The input rule plugin (InputRule.ts) builds its match string as:
   *   textBefore = getTextContentFromNodes($from) + text
   * where `text` is the single character being typed RIGHT NOW and `$from` is the cursor
   * position BEFORE that character is inserted. So the correct simulation is:
   *   1. Insert all characters except the last one directly into the document.
   *   2. Call handleTextInput(view, cursorPos, cursorPos, lastChar) — the plugin will
   *      read the already-inserted prefix from the doc and append lastChar itself.
   */
  const typeText = (text: string) => {
    if (text.length === 0) return

    // Insert the prefix (everything except the final triggering character)
    const prefix = text.slice(0, -1)
    const trigger = text.slice(-1)

    if (prefix.length > 0) {
      const { from, to } = editor.state.selection
      editor.view.dispatch(editor.state.tr.insertText(prefix, from, to))
    }

    // Fire the input rule handler with the final character as the trigger
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

  it('wraps text in a code mark when typing `word`', () => {
    typeText('`hello`')
    expect(editor.getHTML()).toBe('<p><code>hello</code></p>')
  })

  it('wraps multi-word text in a code mark when typing `foo bar`', () => {
    typeText('`foo bar`')
    expect(editor.getHTML()).toBe('<p><code>foo bar</code></p>')
  })

  it('wraps code mark when preceded by regular text', () => {
    typeText('see `code`')
    expect(editor.getHTML()).toBe('<p>see <code>code</code></p>')
  })

  it('does NOT trigger the input rule for an empty backtick pair', () => {
    typeText('``')
    // No code mark — just plain text
    expect(editor.getHTML()).not.toContain('<code>')
  })

  it('does NOT trigger the input rule for a single backtick', () => {
    typeText('`')
    expect(editor.getHTML()).not.toContain('<code>')
  })

  it('does NOT trigger the input rule when the closing backtick is immediately followed by another backtick (triple backtick end)', () => {
    // The negative lookahead (?!`) prevents matching when ``` appears at the end
    typeText('`code``')
    expect(editor.getHTML()).not.toContain('<code>')
  })

  it('does NOT trigger the input rule when the opening backtick is preceded by another backtick', () => {
    // The [^`] guard prevents matching when `` starts the sequence
    typeText('``code`')
    expect(editor.getHTML()).not.toContain('<code>')
  })
})
