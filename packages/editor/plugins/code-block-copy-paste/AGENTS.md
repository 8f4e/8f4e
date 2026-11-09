# Code-block Copy and Paste

- Own clipboard formats and block copy/paste actions. Use injected clipboard functions, `serializeCodeBlocks`
  and `insertCodeBlocks`. Plain-text paste at the caret belongs to keyboard-editing.
- Change only placement `@pos` directives when pasting. Preserve names, references, visual groups,
  nested projects and entry tables.
