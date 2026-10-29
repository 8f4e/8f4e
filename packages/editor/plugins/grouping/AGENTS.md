# Grouping plugin

- Own all editor `@group` behavior here: directive derivation, private membership, menus, actions, drag targets,
  and paste collision renaming. Keep group fields and group-aware policies out of core.
- Nested project groups are language structure owned by core. Restrict visual group operations to the current
  rendered project slice; copying a nested project group preserves its child tree.
- Use the generic synchronous `resolveCodeBlockDragTargets` and `transformPastedCodeBlocks` events. Core owns
  movement/snapping, insertion, and generic source parsing.
- Publish one project change after a complete persisted operation. Only deletion and execution toggling also
  advance compiler input revision. Read-only actions and no-ops publish nothing.
- Keep every registration's disposal explicit. Do not introduce a dependency on the single-module execution plugin.
- Verify with `npx nx run @8f4e/editor-plugin-grouping:build|test|typecheck` and
  `npx nx run @8f4e/editor-plugin-grouping:test:screenshot`.
