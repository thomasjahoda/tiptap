import { Editor } from '@tiptap/core'
import Document from '@tiptap/extension-document'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import { afterEach, describe, expect, it } from 'vitest'

import { BlockMath } from '../src/index.js'

describe('BlockMath', () => {
  let editor: Editor

  afterEach(() => {
    editor?.destroy()
  })

  describe('input rule', () => {
    it('replaces an empty host paragraph instead of leaving it behind', () => {
      editor = new Editor({
        extensions: [Document, Paragraph, Text, BlockMath],
        content: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: '$$$x^2$$' }] }],
        },
      })

      editor.commands.setTextSelection(editor.state.doc.content.size)

      editor.view.someProp('handleTextInput', f =>
        f(editor.view, editor.state.selection.from, editor.state.selection.from, '$'),
      )

      expect(editor.getJSON()).toEqual({
        type: 'doc',
        content: [{ type: 'blockMath', attrs: { latex: 'x^2' } }],
      })
    })

    it('does not fire when the match would not start at the textblock start', () => {
      editor = new Editor({
        extensions: [Document, Paragraph, Text, BlockMath],
        content: {
          type: 'doc',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello $$$x^2$$' }] }],
        },
      })

      editor.commands.setTextSelection(editor.state.doc.content.size)

      const handled = editor.view.someProp('handleTextInput', f =>
        f(editor.view, editor.state.selection.from, editor.state.selection.from, '$'),
      )

      expect(handled).toBeFalsy()
      expect(editor.getJSON()).toEqual({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hello $$$x^2$$' }] }],
      })
    })
  })
})
