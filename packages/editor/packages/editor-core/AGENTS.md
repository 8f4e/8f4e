# Editor Core Guidelines

## Core Boundaries

- Editor-core owns plugin installation, initialization and the frame loop. Advance viewport animation before
  each render. Finish initial project and font loading before drawing and emit `ready` after the first render.
  Dispose plugins in reverse installation order and continue cleanup if a disposer throws.
- Editor-state owns the project tree, entry assignment and bounds, history, generic source operations, folding,
  text geometry and pointer routing. Keep editor `@group` behavior, authoring commands and browser input in plugins.
  Keep clipboard, file handling and session persistence in their owning plugins.
- Keep raw menu items, dialog content, actions and input blocking in state. Presentation plugins own their
  geometry, hit testing and drawing. Entry assignment works independently of the outline drawer.
- Web-ui owns font/color configuration, atlas loading, drawing and GPU resources. Register its configuration
  before plugin setup and project loading. Editor-state depends on generic grid dimensions.
- Keep raw loading records, contributor-owned errors and assertion results in state. Producers own outcomes and
  presentation plugins own derived geometry and visibility. Replacing a loading ID invalidates older handles.
- Emit `compilationInputChanged` on compiler-input revisions and consume accepted program artifacts to update
  memory views. Keep accepted metadata in `state.compiler.result` independently of progress. Scheduling, worker
  lifetime and writable memory handles belong to the compiler plugin.

## Editing and Layout

- Use the shared source update path in `features/code-blocks/sourceUpdates.ts` to settle derived state. Route
  removals through `deleteCodeBlocks`. Source-edit batches emit `codeBlockSourcesChanged` before revisions advance.
- Keep edits on `Editor.editing` and view navigation on `Editor.navigation`. Validate edits before applying a batch
  as one undo step. Use existing state and block handles for reads and targeting. Keep adapter projections outside
  core and derive positions from source directives.
- Publish `state.projectChange` once after a completed edit, history action or project replacement, after derived
  state settles. Navigation and no-ops leave the revision alone. Share this revision across history, editing and
  persistence, with a separate compiler-input revision. Editing works without the history effect installed.
- Preserve local entry tables, including empty entries, across loading, history, clipboard and serialization.
  Keep remembered viewport and selection in memory. Use canonical detached project snapshots from
  `pureHelpers/projectSerialization`. Project-save owns the text file format.
- The layout coordinator tracks ownership and anchors per project level. Viewport changes reposition active
  anchors without rebuilding membership or source layout. Publish `codeBlockLayoutsChanged { project, codeBlocks }`
  after the affected blocks settle. Consumers refresh the listed blocks and use project identity for view checks.
- Changes to plugin layout contributions rederive affected layouts independently of source edits and compilation.
  Infer lifecycle payloads from `EditorLifecycleEvents`.

## Input and Drawing

- Route normalized pointer events before default block selection and dragging. UI input layers match drawer
  stages in `INPUT_LAYERS`. Dispatch higher layers first and handlers within each capture or normal phase in
  reverse registration order. Preserve FIFO delivery for unlayered notifications and default effects.
- Draw in registration order within each stage. Use one block drawer registry in the visible-block traversal
  and the dedicated offscreen callback for offscreen decoration. Draw context menus above canvas overlays and
  dialogs above menus. Modal drawing is independent of `canvasOverlays`.
- Web-ui owns generic render-layer initialization, palette updates, memory release and disposal. Feature plugins
  own prepared glyphs, drawing data and rendering passes, including connector widgets and wires.
- Test against built workspace exports. Use `npx nx run @8f4e/editor-core:test:screenshot` for real-renderer
  viewport and culling coverage.
