---
'@tiptap/extension-text-style': patch
'@tiptap/extension-highlight': patch
---

Fix `&quot;` HTML entity encoding in `getHTML()` output for `font-family`, `font-size`, `line-height`, and `highlight` background-color attributes by parsing the raw inline `style` attribute instead of CSSOM-canonicalized values (#7016)
