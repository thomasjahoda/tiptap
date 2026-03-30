---
"@tiptap/extension-emoji": patch
---

Use a named import for Suggestion from `@tiptap/suggestion` to avoid bundler ESM/CJS interop
wrapping (`__toESM`) that caused CJS consumers to receive a module object instead of the
callable plugin factory.

This is a non-breaking internal fix identical to the one applied to `@tiptap/extension-mention`
in #6994.
