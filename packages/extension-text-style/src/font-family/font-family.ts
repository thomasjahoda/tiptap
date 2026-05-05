import '../text-style/index.js'

import { Extension } from '@tiptap/core'

export type FontFamilyOptions = {
  /**
   * A list of node names where the font family can be applied.
   * @default ['textStyle']
   * @example ['heading', 'paragraph']
   */
  types: string[]
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontFamily: {
      /**
       * Set the font family
       * @param fontFamily The font family
       * @example editor.commands.setFontFamily('Arial')
       */
      setFontFamily: (fontFamily: string) => ReturnType
      /**
       * Unset the font family
       * @example editor.commands.unsetFontFamily()
       */
      unsetFontFamily: () => ReturnType
    }
  }
}

// @ts-ignore because the module is not found during dts build
declare module '@tiptap/extension-text-style' {
  interface TextStyleAttributes {
    fontFamily?: string | null
  }
}

/**
 * This extension allows you to set a font family for text.
 * @see https://www.tiptap.dev/api/extensions/font-family
 */
export const FontFamily = Extension.create<FontFamilyOptions>({
  name: 'fontFamily',

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
          fontFamily: {
            default: null,
            parseHTML: element => {
              // Prefer the raw inline `style` attribute so we preserve
              // the original format (e.g. unquoted or single-quoted
              // multi-word names) instead of the canonicalized value
              // returned by `element.style.fontFamily`, which forces
              // double quotes that then get HTML-encoded to `&quot;`
              // when the style attribute is serialized.
              // When nested spans are merged the style attribute may
              // contain multiple `font-family:` declarations
              // (parent;child). We should pick the last declaration so
              // the child's font-family takes priority.
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
                    if (prop === 'font-family') {
                      return val
                    }
                  }
                }
              }

              return element.style.fontFamily
            },
            renderHTML: attributes => {
              if (!attributes.fontFamily) {
                return {}
              }

              return {
                style: `font-family: ${attributes.fontFamily}`,
              }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setFontFamily:
        fontFamily =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontFamily }).run()
        },
      unsetFontFamily:
        () =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontFamily: null }).removeEmptyTextStyle().run()
        },
    }
  },
})
