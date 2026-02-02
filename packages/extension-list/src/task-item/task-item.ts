import type { KeyboardShortcutCommand } from '@tiptap/core'
import {
  getRenderedAttributes,
  mergeAttributes,
  Node,
  renderNestedMarkdownContent,
  wrappingInputRule,
} from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'

export interface TaskItemOptions {
  /**
   * A callback function that is called when the checkbox is clicked while the editor is in readonly mode.
   * @param node The prosemirror node of the task item
   * @param checked The new checked state
   * @returns boolean whether the change to the checkbox state should be accepted or reverted - or whether the editor content should be updated
   */
  onReadOnlyChecked?: (node: ProseMirrorNode, checked: boolean) => boolean | 'updateEditorContent'

  /**
   * Controls whether the task items can be nested or not.
   * @default false
   * @example true
   */
  nested: boolean

  /**
   * HTML attributes to add to the task item element.
   * @default {}
   * @example { class: 'foo' }
   */
  HTMLAttributes: Record<string, any>

  /**
   * The node type for taskList nodes
   * @default 'taskList'
   * @example 'myCustomTaskList'
   */
  taskListTypeName: string

  /**
   * Accessibility options for the task item.
   * @default {}
   * @example
   * ```js
   * {
   *   checkboxLabel: (node) => `Task item: ${node.textContent || 'empty task item'}`
   * }
   */
  a11y?: {
    checkboxLabel?: (node: ProseMirrorNode, checked: boolean) => string
  }
}

/**
 * Matches a task item from "[]", "[x]" "[ ]", or (PATCHED) ".".
 */
export const inputRegex = /^\s*((\[([( |x])?\])|\.)\s$/

/**
 * Attaches all pointer, mouse, and touch event listeners to an element
 * with stopPropagation and preventDefault invoked.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function attachAllInputListeners(element: HTMLElement): void {
  const eventTypes: string[] = [
    // Pointer Events (Modern, unified)
    'pointerdown',
    'pointerup',
    'pointermove',
    'pointerover',
    'pointerout',
    'pointerenter',
    'pointerleave',
    'pointercancel',

    // Mouse Events (Legacy/Specific)
    'mousedown',
    'mouseup',
    'mousemove',
    'mouseover',
    'mouseout',
    'mouseenter',
    'mouseleave',
    'click',
    'dblclick',
    'contextmenu',

    // Touch Events (Mobile specific)
    'touchstart',
    'touchend',
    'touchmove',
    'touchcancel',

    // Focus Events
    'focus',
    'blur',
    'focusin',
    'focusout',
  ]

  const genericHandler = (event: Event): void => {
    // Prevents the default browser action (e.g., scrolling, text selection)
    event.preventDefault()

    // Stops the event from bubbling up to parent elements
    event.stopPropagation()

    // 3. Specific Focus Logic:
    // If the element somehow gains focus despite preventDefault,
    // we forcefully remove it.
    if (event.type === 'focus' || event.type === 'focusin') {
      ;(event.currentTarget as HTMLElement).blur()
    }

    console.log(`Event captured: ${event.type}`, {
      target: event.target,
      timestamp: event.timeStamp,
    })
  }

  eventTypes.forEach(type => {
    element.addEventListener(type, genericHandler, {
      capture: true, // Intercepts event on the way down
      passive: false,
    })
  })

  // Extra precaution: prevent the element from being tab-accessible
  element.setAttribute('tabindex', '-1')
}

/**
 * This extension allows you to create task items.
 * @see https://www.tiptap.dev/api/nodes/task-item
 */
export const TaskItem = Node.create<TaskItemOptions>({
  name: 'taskItem',

  addOptions() {
    return {
      nested: false,
      HTMLAttributes: {},
      taskListTypeName: 'taskList',
      a11y: undefined,
    }
  },

  content() {
    return this.options.nested ? 'paragraph block*' : 'paragraph+'
  },

  defining: true,

  addAttributes() {
    return {
      checked: {
        default: false,
        keepOnSplit: false,
        parseHTML: element => {
          const dataChecked = element.getAttribute('data-checked')

          return dataChecked === '' || dataChecked === 'true'
        },
        renderHTML: attributes => ({
          'data-checked': attributes.checked,
        }),
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: `li[data-type="${this.name}"]`,
        priority: 51,
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'li',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': this.name,
        role: 'checkbox',
        'aria-checked': HTMLAttributes.checked ? 'true' : 'false',
      }),
      [
        'label',
        [
          'span',
          {
            class: 'tiptap-task-item-checkbox',
            'data-checked': node.attrs.checked ? 'checked' : null,
          },
        ],
        [
          'span',
          {
            class: 'tiptap-task-item-checkbox-styler',
          },
        ],
      ],
      ['div', 0],
    ]
  },

  parseMarkdown: (token, h) => {
    // Parse the task item's text content into paragraph content
    const content = []

    // First, add the main paragraph content
    if (token.tokens && token.tokens.length > 0) {
      // If we have tokens, create a paragraph with the inline content
      content.push(h.createNode('paragraph', {}, h.parseInline(token.tokens)))
    } else if (token.text) {
      // If we have raw text, create a paragraph with text node
      content.push(h.createNode('paragraph', {}, [h.createNode('text', { text: token.text })]))
    } else {
      // Fallback: empty paragraph
      content.push(h.createNode('paragraph', {}, []))
    }

    // Then, add any nested content (like nested task lists)
    if (token.nestedTokens && token.nestedTokens.length > 0) {
      const nestedContent = h.parseChildren(token.nestedTokens)
      content.push(...nestedContent)
    }

    return h.createNode('taskItem', { checked: token.checked || false }, content)
  },

  renderMarkdown: (node, h) => {
    const checkedChar = node.attrs?.checked ? 'x' : ' '
    const prefix = `- [${checkedChar}] `

    return renderNestedMarkdownContent(node, h, prefix)
  },

  addKeyboardShortcuts() {
    const shortcuts: {
      [key: string]: KeyboardShortcutCommand
    } = {
      Enter: () => this.editor.commands.splitListItem(this.name),
      'Shift-Tab': () => this.editor.commands.liftListItem(this.name),
    }

    if (!this.options.nested) {
      return shortcuts
    }

    return {
      ...shortcuts,
      Tab: () => this.editor.commands.sinkListItem(this.name),
    }
  },

  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor }) => {
      const listItem = document.createElement('li')
      const checkboxWrapper = document.createElement('label')
      const checkboxStyler = document.createElement('span')
      const checkbox = document.createElement('span')
      const content = document.createElement('div')

      checkbox.classList.add('tiptap-task-item-checkbox')
      checkboxStyler.classList.add('tiptap-task-item-checkbox-styler')

      const updateA11Y = (currentNode: ProseMirrorNode) => {
        checkbox.ariaLabel =
          this.options.a11y?.checkboxLabel?.(currentNode, checkbox.dataset.checked === 'true') ||
          `Task item checkbox for ${currentNode.textContent || 'empty task item'}`
      }

      updateA11Y(node)

      checkboxWrapper.contentEditable = 'false'
      // checkbox.contentEditable = 'false' // does not seem to help, but at least I tried I guess
      // checkbox.addEventListener('mousedown', event => event.preventDefault())
      // attachAllInputListeners(checkbox)
      checkbox.addEventListener('click', _event => {
        // Determine the new checked state based on the current attribute
        // (Spans don't natively toggle, so we calculate the inverse of the current state)
        const oldChecked = checkbox.getAttribute('data-checked') === 'true'
        const newChecked = !oldChecked

        // if the editor isn’t editable and we don't have a handler for readonly checks we simply ignore the click
        if (!editor.isEditable && !this.options.onReadOnlyChecked) {
          // No visual "undo" needed for span as it doesn't auto-update like an input
          return
        }

        if (editor.isEditable && typeof getPos === 'function') {
          editor
            .chain()
            .focus(undefined, { scrollIntoView: false })
            .command(({ tr }) => {
              const position = getPos()

              if (typeof position !== 'number') {
                return false
              }
              const currentNode = tr.doc.nodeAt(position)

              tr.setNodeMarkup(position, undefined, {
                ...currentNode?.attrs,
                checked: newChecked,
              })

              return true
            })
            .run()
        }
        if (!editor.isEditable && this.options.onReadOnlyChecked) {
          // Reset state if onReadOnlyChecked returns false
          const result = this.options.onReadOnlyChecked(node, newChecked)
          if (result === false) {
            // No visual "undo" needed for span as it doesn't auto-update like an input
          } else if (result === true) {
            // change the toggle, but don't actually update the editor content
            checkbox.dataset.checked = newChecked.toString()
          } else if (result === 'updateEditorContent') {
            // update the editor content to reflect the change
            editor
              .chain()
              .command(({ tr }) => {
                const position = getPos()

                if (typeof position !== 'number') {
                  return false
                }
                const currentNode = tr.doc.nodeAt(position)

                tr.setNodeMarkup(position, undefined, {
                  ...currentNode?.attrs,
                  checked: newChecked,
                })

                return true
              })
              .run()
          }
        }
      })

      Object.entries(this.options.HTMLAttributes).forEach(([key, value]) => {
        listItem.setAttribute(key, value)
      })

      listItem.dataset.checked = node.attrs.checked.toString()
      listItem.setAttribute('aria-checked', node.attrs.checked.toString())
      checkbox.dataset.checked = node.attrs.checked.toString()

      checkboxWrapper.append(checkbox, checkboxStyler)
      listItem.append(checkboxWrapper, content)

      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        listItem.setAttribute(key, value)
      })

      // Track the keys of previously rendered HTML attributes for proper removal
      let prevRenderedAttributeKeys = new Set(Object.keys(HTMLAttributes))

      return {
        dom: listItem,
        contentDOM: content,
        update: updatedNode => {
          if (updatedNode.type !== this.type) {
            return false
          }

          listItem.dataset.checked = updatedNode.attrs.checked
          listItem.setAttribute('aria-checked', updatedNode.attrs.checked.toString())
          checkbox.dataset.checked = updatedNode.attrs.checked
          updateA11Y(updatedNode)

          // Sync all HTML attributes from the updated node
          const extensionAttributes = editor.extensionManager.attributes
          const newHTMLAttributes = getRenderedAttributes(updatedNode, extensionAttributes)
          const newKeys = new Set(Object.keys(newHTMLAttributes))

          // Remove attributes that were previously rendered but are no longer present
          // If the attribute exists in static options, restore it instead of removing
          const staticAttrs = this.options.HTMLAttributes

          prevRenderedAttributeKeys.forEach(key => {
            if (!newKeys.has(key)) {
              if (key in staticAttrs) {
                listItem.setAttribute(key, staticAttrs[key])
              } else {
                listItem.removeAttribute(key)
              }
            }
          })

          // Update or add new attributes
          Object.entries(newHTMLAttributes).forEach(([key, value]) => {
            if (value === null || value === undefined) {
              // If the attribute exists in static options, restore it instead of removing
              if (key in staticAttrs) {
                listItem.setAttribute(key, staticAttrs[key])
              } else {
                listItem.removeAttribute(key)
              }
            } else {
              listItem.setAttribute(key, value)
            }
          })

          // Update the tracked keys for next update
          prevRenderedAttributeKeys = newKeys

          return true
        },
      }
    }
  },

  addInputRules() {
    return [
      wrappingInputRule({
        find: inputRegex,
        type: this.type,
        getAttributes: match => ({
          checked: match[match.length - 1] === 'x',
        }),
      }),
    ]
  },
})
