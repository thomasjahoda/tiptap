import type { KeyboardShortcutCommand } from '@tiptap/core'
import { mergeAttributes, Node, wrappingInputRule } from '@tiptap/core'
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
 * Matches a task item to a - [ ] on input.
 */
export const inputRegex = /^\s*(\[([( |x])?\])\s$/

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
      }),
      [
        'label',
        [
          'input',
          {
            type: 'checkbox',
            checked: node.attrs.checked ? 'checked' : null,
          },
        ],
        ['span'],
      ],
      ['div', 0],
    ]
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
      const checkbox = document.createElement('input')
      const content = document.createElement('div')

      const updateA11Y = () => {
        checkbox.ariaLabel =
          this.options.a11y?.checkboxLabel?.(node, checkbox.checked) ||
          `Task item checkbox for ${node.textContent || 'empty task item'}`
      }

      updateA11Y()

      checkboxWrapper.contentEditable = 'false'
      checkbox.type = 'checkbox'
      checkbox.addEventListener('mousedown', event => event.preventDefault())
      checkbox.addEventListener('change', event => {
        // if the editor isn’t editable and we don't have a handler for
        // readonly checks we have to undo the latest change
        if (!editor.isEditable && !this.options.onReadOnlyChecked) {
          checkbox.checked = !checkbox.checked

          return
        }

        const { checked } = event.target as any

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
                checked,
              })

              return true
            })
            .run()
        }
        if (!editor.isEditable && this.options.onReadOnlyChecked) {
          // Reset state if onReadOnlyChecked returns false
          const result = this.options.onReadOnlyChecked(node, checked)
          if (result === false) {
            checkbox.checked = !checkbox.checked
          } else if (result === true) {
            // simply accept the change and do nothing
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
                  checked,
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

      listItem.dataset.checked = node.attrs.checked
      checkbox.checked = node.attrs.checked

      checkboxWrapper.append(checkbox, checkboxStyler)
      listItem.append(checkboxWrapper, content)

      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        listItem.setAttribute(key, value)
      })

      return {
        dom: listItem,
        contentDOM: content,
        update: updatedNode => {
          if (updatedNode.type !== this.type) {
            return false
          }

          listItem.dataset.checked = updatedNode.attrs.checked
          checkbox.checked = updatedNode.attrs.checked
          updateA11Y()

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
