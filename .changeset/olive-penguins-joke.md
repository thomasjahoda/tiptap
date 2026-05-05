---
'@tiptap/core': patch
'@tiptap/extension-text-style': patch
'@tiptap/extension-highlight': patch
---

Fix `&quot;` HTML entity encoding in `getHTML()` output for inline style attributes. Adds a `getStyleProperty` utility to `@tiptap/core` and migrates `Color`, `BackgroundColor`, `FontFamily`, `FontSize`, `LineHeight`, and `Highlight` extensions to use it (#7016)
