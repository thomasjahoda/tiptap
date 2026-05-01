---
"@tiptap/extension-mathematics": patch
---

Fix `updateBlockMath` silently ignoring `latex: ''`. The command used a falsy fallback (`latex || node.attrs.latex`) that treated an explicit empty string the same as `undefined`, leaving the node unchanged. It now uses `latex ?? node.attrs.latex`, matching `updateInlineMath`, so callers can clear the rendered LaTeX while preserving the "no value passed" case.
