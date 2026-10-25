# Toggle Skip Execution Plugin

- This package owns only the single-module execution toggle. Group toggling remains in editor-state.
- Export an `EditorStatePlugin` without installing it as an import side effect. It is included by editor-default.
- Own the Skip/Unskip menu label, visibility, and target payload here through `menus.registerItem`; keep editor-state's
  menu composition generic.
- Use public workspace APIs; the source transformation is shared through `@8f4e/editor-state`.
- Return a disposer that removes every listener and menu registration created by this plugin. The host calls that
  disposer; it does not track individual registrations. Test lifecycle behavior through editor-state initialization.
- Run `npx nx run @8f4e/editor-plugin-toggle-skip-execution:build|test|typecheck` after changes.
- Keep tests for source edits, compiler revision changes, menu registration and selection, edit-mode gating, cleanup,
  and editor instance isolation.
