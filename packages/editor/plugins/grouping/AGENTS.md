# Grouping plugin

- Own all editor `@group` behavior here: directive derivation, private membership, menus, actions, drag targets,
  and copying. Keep group fields and group-aware policies out of core.
- Match cached directive records through `matchEditorDirectives`; accept standalone and trailing comments uniformly.
- Nested project groups are language structure owned by core. Restrict visual group operations to the current
  rendered project slice; copying a nested project group preserves its child tree.
- Use the generic synchronous `resolveCodeBlockDragTargets` event. Core owns
  movement/snapping, insertion, and generic source parsing.
- Apply source-edit batches through `applyCodeBlockSourceEdits` and deletions through `deleteCodeBlocks`. Only
  deletion and execution toggling affect compilation. Read-only actions and no-ops publish nothing.
- The nonstick setter action is `setGroupNonstick`, with an explicit `makeNonstick` value.
- Receive `writeClipboardText` through `createGroupingPlugin`; use the pure block serializer for group copying. Do not rename groups during paste or subscribe to paste transforms.
- Keep every registration's disposal explicit. Do not introduce a dependency on the single-module execution plugin.
- Verify with `npx nx run @8f4e/editor-plugin-grouping:build|test|typecheck` and
  `npx nx run @8f4e/editor-plugin-grouping:test:screenshot`.
