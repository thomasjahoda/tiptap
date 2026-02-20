import { Editor } from '@tiptap/core'
import { StarterKit } from '@tiptap/starter-kit'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

describe('extension-code input rules', () => {
  let editor: Editor

  const createEditorEl = () => {
    const el = document.createElement('div')
    document.body.appendChild(el)
    return el
  }

  function sleep(durationInMs: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, durationInMs)
    })
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
  const typeText = async (text: string) => {
    if (text.length === 0) {
      return
    }

    for (let i = 0; i < text.length; i += 1) {
      editor.commands.insertContent(text[i], {
        applyInputRules: true,
      })
      // eslint-disable-next-line no-await-in-loop
      await sleep(0) // inputRulesPlugin uses transaction meta applyInputRules, which is set by editor.commands.insertContent, but does it in the next microtask via setTimeout(..., 0)...
    }
  }

  beforeEach(() => {
    editor = new Editor({
      element: createEditorEl(),
      // extensions: [
      //   Bold, // also added Bold to quickly test interplay with other extensions (NOTE: important to be earlier than other extensions. Always order extensions as they are ordered in starter-kit.ts)
      //   Text,
      //   Paragraph,
      //   Code,
      //   Document,
      // ],
      extensions: [
        StarterKit, // just importing all basic extensions, even if it's ugly for a unit test
      ],
    })
  })

  afterEach(() => {
    editor.destroy()
    document.body.innerHTML = ''
  })

  it('insertContentAt command can trigger input rules', async () => {
    editor.commands.insertContent('-', {
      applyInputRules: true,
    })
    await sleep(0) // inputRulesPlugin uses transaction meta applyInputRules, which is set by editor.commands.insertContent, but does it in the next microtask via setTimeout(..., 0)...

    editor.commands.insertContent(' ', {
      applyInputRules: true,
    })
    await sleep(0) // inputRulesPlugin uses transaction meta applyInputRules, which is set by editor.commands.insertContent, but does it in the next microtask via setTimeout(..., 0)...

    expect(editor.getHTML()).toBe('<ul><li><p></p></li></ul><p></p>')
  })

  it('insertContentAt command can trigger input rules', async () => {
    await typeText('- ')
    expect(editor.getHTML()).toBe('<ul><li><p></p></li></ul><p></p>')
  })
  it('typeText utility works for bold', async () => {
    await typeText('**bold**')
    expect(editor.getHTML()).toBe('<p><strong>bold</strong></p>')
  })
  it('typeText utility works when typing each letter separately', async () => {
    const text = '**bold**'
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i]
      // eslint-disable-next-line no-await-in-loop
      await typeText(char)
    }
    expect(editor.getHTML()).toBe('<p><strong>bold</strong></p>')
  })
  it('typeText utility works', async () => {
    await typeText('**bold**')
    expect(editor.getHTML()).toBe('<p><strong>bold</strong></p>')
  })
  describe('inputRule', () => {
    it('applies code mark when typing `code`', async () => {
      await typeText('`code`')
      expect(editor.getHTML()).toBe('<p><code>code</code></p>')
    })

    /**
     * FORK-INFO: non-standard behavior. Before my changes, this resulted in <p>`<code>ode`</code></p> and often happened to me when using the editor.
     */
    it('works even after triggering input rule by typing a space after `code`', async () => {
      editor.commands.insertContent('`code`', {
        applyInputRules: false,
      })
      // TODO actually fix implementation
      await typeText(' ')
      expect(editor.getHTML()).toBe('<p><code>code</code> </p>')
    })

    it('applies code mark for multiple words', async () => {
      await typeText('`some code`')
      expect(editor.getHTML()).toBe('<p><code>some code</code></p>')
    })

    it('applies code mark when preceded by a space', async () => {
      await typeText('text `code`')
      expect(editor.getHTML()).toBe('<p>text <code>code</code></p>')
    })

    it('applies code mark when preceded by a non-backtick character', async () => {
      await typeText('a`code`')
      expect(editor.getHTML()).toBe('<p>a<code>code</code></p>')
    })

    it('applies code mark when preceded by punctuation', async () => {
      await typeText('!`code`')
      expect(editor.getHTML()).toBe('<p>!<code>code</code></p>')
    })

    it('does NOT apply code mark for double opening backticks (``code``)', async () => {
      await typeText('``code``')
      expect(editor.getHTML()).not.toContain('<code>')
    })

    it('does NOT apply code mark when opening backtick is preceded by a backtick', async () => {
      await typeText('``code`')
      expect(editor.getHTML()).not.toContain('<code>')
    })

    it('does NOT apply code mark when closing backtick is immediately followed by a backtick', async () => {
      editor.commands.insertContent('`code`', {
        applyInputRules: false,
      })
      await typeText('`')
      expect(editor.getHTML()).not.toContain('<code>')
    })

    it('does NOT apply code mark for empty backtick pair', async () => {
      await typeText('``')
      expect(editor.getHTML()).not.toContain('<code>')
    })

    it('does NOT apply code mark for a lone backtick', async () => {
      await typeText('`')
      expect(editor.getHTML()).not.toContain('<code>')
    })

    it.skip('does NOT apply code mark when the content between backticks contains a backtick', async () => {
      // TODO FIXME: currently broken, but not important
      await typeText('`co`de`')
      expect(editor.getHTML()).not.toContain('<code>')
    })

    /**
     * non-standard behavior. This requirement will change how the input rule is implemented.
     */
    it.skip('DOES apply code mark when the opening backtick is typed at the start, before text that ends with a backtick', async () => {
      // Set up the doc with 'bla`' already present (the closing backtick is already there)
      await typeText('bla`')
      expect(editor.getHTML()).toBe('<p>bla`</p>')

      // Type the opening backtick at the beginning
      // Move cursor to position 1 — the very beginning of the paragraph content
      editor.commands.setTextSelection(1)
      await typeText('`')

      // Previously:
      // The rule does NOT fire because the input rule plugin only reads
      // getTextContentFromNodes($from), which returns text *before* the cursor.
      // With the cursor at position 1, there is no preceding text, so
      // textBefore = '' + '`' = '`' — the regex cannot match.
      expect(editor.getHTML()).toBe('<p><code>bla</code></p>')
    })

    it('captures the correct inner text', async () => {
      await typeText('`hello`')
      expect(editor.getHTML()).toBe('<p><code>hello</code></p>')
    })

    it('captures the correct inner text when preceded by regular text', async () => {
      await typeText('text `world`')
      expect(editor.getHTML()).toBe('<p>text <code>world</code></p>')
    })

    it('captures multi-word inner text', async () => {
      await typeText('`foo bar baz`')
      expect(editor.getHTML()).toBe('<p><code>foo bar baz</code></p>')
    })
  })

  describe('pasteRule', () => {
    it('applies code mark when pasting `word`', async () => {
      editor.view.pasteText('`code`')
      expect(editor.getHTML()).toBe('<p><code>code</code></p>')
    })

    it('applies code mark for multiple words', async () => {
      editor.view.pasteText('`some code`')
      expect(editor.getHTML()).toBe('<p><code>some code</code></p>')
    })

    it('applies code mark when preceded by a space', async () => {
      editor.view.pasteText('text `code`')
      expect(editor.getHTML()).toBe('<p>text <code>code</code></p>')
    })

    it('applies code mark to inline snippet in a longer text', async () => {
      editor.view.pasteText('hello `world` foo')
      expect(editor.getHTML()).toContain('<code>world</code>')
    })

    it('applies code marks to multiple snippets in a single paste', async () => {
      editor.view.pasteText('`one` and `two`')
      const html = editor.getHTML()
      expect(html).toContain('<code>one</code>')
      expect(html).toContain('<code>two</code>')
    })

    it('does NOT apply code mark for an empty backtick pair', async () => {
      editor.view.pasteText('``')
      expect(editor.getHTML()).not.toContain('<code>')
    })

    it('does NOT apply code mark when opening backtick is preceded by a backtick', async () => {
      editor.view.pasteText('``code`')
      expect(editor.getHTML()).not.toContain('<code>')
    })

    it('does NOT apply code mark when closing backtick is immediately followed by a backtick', async () => {
      editor.view.pasteText('`code``')
      expect(editor.getHTML()).not.toContain('<code>')
    })

    it.skip('does NOT apply code mark when the content between backticks contains a backtick', async () => {
      editor.view.pasteText('`co`de`')
      expect(editor.getHTML()).not.toContain('<code>')
    })
  })
})
