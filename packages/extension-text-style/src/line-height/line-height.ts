import '../text-style/index.js'

import { Extension } from '@tiptap/core'

export type LineHeightOptions = {
  /**
   * A list of node names where the line height can be applied.
   * @default ['textStyle']
   * @example ['heading', 'paragraph']
   */
  types: string[]
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    lineHeight: {
      /**
       * Set the line height
       * @param lineHeight The line height
       * @example editor.commands.setLineHeight('1.5')
       */
      setLineHeight: (lineHeight: string) => ReturnType
      /**
       * Unset the line height
       * @example editor.commands.unsetLineHeight()
       */
      unsetLineHeight: () => ReturnType
    }
  }
}

// @ts-ignore because the module is not found during dts build
declare module '@tiptap/extension-text-style' {
  interface TextStyleAttributes {
    lineHeight?: string | null
  }
}

/**
 * This extension allows you to set the line-height for text.
 * @see https://www.tiptap.dev/api/extensions/line-height
 */
export const LineHeight = Extension.create<LineHeightOptions>({
  name: 'lineHeight',

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
          lineHeight: {
            default: null,
            parseHTML: element => {
              // Prefer the raw inline `style` attribute so we preserve
              // the original format instead of the canonicalized value
              // returned by `element.style.lineHeight`.
              // When nested spans are merged the style attribute may
              // contain multiple `line-height:` declarations
              // (parent;child). We should pick the last declaration so
              // the child's line-height takes priority.
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
                    if (prop === 'line-height') {
                      return val
                    }
                  }
                }
              }

              return element.style.lineHeight
            },
            renderHTML: attributes => {
              if (!attributes.lineHeight) {
                return {}
              }

              return {
                style: `line-height: ${attributes.lineHeight}`,
              }
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      setLineHeight:
        lineHeight =>
        ({ chain }) => {
          return chain().setMark('textStyle', { lineHeight }).run()
        },
      unsetLineHeight:
        () =>
        ({ chain }) => {
          return chain().setMark('textStyle', { lineHeight: null }).removeEmptyTextStyle().run()
        },
    }
  },
})
