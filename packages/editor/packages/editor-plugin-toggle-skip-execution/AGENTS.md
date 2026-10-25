# Toggle Skip Execution Plugin

- This package owns only the single-module execution toggle. Group toggling remains in editor-state.
- Export an `EditorStatePlugin` without installing it as an import side effect. It is included by editor-default.
- Use public workspace APIs; the source transformation is shared through `@8f4e/editor-state`.
- Run `npx nx run @8f4e/editor-plugin-toggle-skip-execution:build|test|typecheck` after changes.
- Keep tests for source edits, compiler revision changes, edit-mode gating, cleanup, and editor instance isolation.
