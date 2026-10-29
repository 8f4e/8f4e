# Editor grouping plugin

`@8f4e/editor-plugin-grouping` owns visual block grouping through `; @group <name> [nonstick]`.
Install `groupingPlugin` in the editor's `plugins` array. The default editor includes it.

The plugin owns group membership, drag-target selection, paste collision renaming, and the block-menu actions:
Copy group, Delete group, Remove from group, Ungroup, Make Group Sticky/Nonstick, Align blocks in row, and Skip/Unskip
group. Group execution toggling applies to modules. The single-module execution-toggle plugin is independent.

Blocks in a sticky group drag together; Alt drags only the clicked block. Nonstick groups reverse this behavior.
Membership uses the first valid standalone `@group` directive, read from core's generic parsed directive records
when an action runs. The plugin adds no membership fields or caches to core state.
Actions operate on the currently visible project slice. Copy preserves creation order, relative positions, and
recursively owned project blocks. Pasting gives each incoming group an available name while keeping its members
together; child project slices retain their independent grouping names.

The plugin registers menu items and event listeners and explicitly unregisters them when disposed.
It receives no browser resources. Copy uses the editor's clipboard callback and its generic clipboard serializer.
Core handles generic source parsing, movement, snapping, insertion, history, and project changes.
Group edits use core's source-edit and deletion helpers to refresh affected blocks and announce each operation once.
The `setGroupNonstick` action receives `{ codeBlock, makeNonstick }` and applies that requested mode to the group.

Nested language-level project groups (`group … groupEnd`) remain core project structure, including their navigation
and memory scopes. They can participate in visual grouping like other blocks.

Run `npx nx run @8f4e/editor-plugin-grouping:build|test|typecheck` and
`npx nx run @8f4e/editor-plugin-grouping:test:screenshot` to verify the plugin.
