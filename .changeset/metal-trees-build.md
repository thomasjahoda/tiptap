---
'@tiptap/extension-drag-handle': patch
---

Updated `findElementNextToCoords` to fall back to `view.posAtCoords` when `elementsFromPoint` returns no matching block, resolving the position to the top-level block node.
