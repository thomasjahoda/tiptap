import '../text-style/index.js'

import { Extension } from '@tiptap/core'

export type FontSizeOptions = {
  /**
   * A list of node names where the font size can be applied.
   * @default ['textStyle']
   * @example ['heading', 'paragraph']
   */
  types: string[]
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      /**
       * Set the font size
       * @param fontSize The font size
       * @example editor.commands.setFontSize('16px')
       */
      setFontSize: (fontSize: string) => ReturnType
      /**
       * Unset the font size
       * @example editor.commands.unsetFontSize()
       */
      unsetFontSize: () => ReturnType
    }
  }
}

// @ts-ignore because the module is not found during dts build
declare module '@tiptap/extension-text-style' {
  interface TextStyleAttributes {
    fontSize?: string | null
  }
}

/**
 * This extension allows you to set a font size for text.
 * @see https://www.tiptap.dev/api/extensions/font-size
 */
export const FontSize = Extension.create<FontSizeOptions>({
  name: 'fontSize',

  addOptions() {
    return {
      types: ['textStyle'],
    }
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => {
              // Prefer the raw inline `style` attribute so we preserve
              // the original format instead of the canonicalized value
              // returned by `element.style.fontSize`.
              // When nested spans are merged the style attribute may
              // contain multiple `font-size:` declarations
              // (parent;child). We should pick the last declaration so
              // the child's font-size takes priority.
              const styleAttr = element.getAttribute('style')
              if (styleAttr) {
                const decls = styleAttr
                  .split(';')
                  .map(s => s.trim())
                  .filter(Boolean)
                for (let i = decls.length - 1; i >= 0; i -= 1) {
                  const parts = decls[i].split(':')
                  if (parts.length >= 2) {
                    const prop = parts[0].trim().toLowerCase()
                    const val = parts.slice(1).join(':').trim()
                    if (prop === 'font-size') {
                      return val
                    }
                  }
                }
              }

              return element.style.fontSize
            },
            renderHTML: attributes => {
              if (!attributes.fontSize) {
                return {}
              }

              return {
                style: `font-size: ${attributes.fontSize}`,
              }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setFontSize:
        fontSize =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontSize }).run()
        },
      unsetFontSize:
        () =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run()
        },
    }
  },
})
