# Editor Core Guidelines

## Core Boundaries

- Editor-core owns plugin installation, initialization and the frame loop. Pass the frame timestamp to web-ui.
  Await source-only `prepareInitialProject` before loading the selected font and settling layout and first-visit
  placement. Draw the first frame, then emit `ready`.
  Dispose plugins in reverse installation order and continue cleanup if a disposer throws.
- Editor-state owns the project tree, entry assignment and bounds, history, generic source operations, folding,
  text geometry and pointer routing. Keep editor `@group` behavior, authoring commands and browser input in plugins.
  Keep clipboard, file handling and session persistence in their owning plugins.
- Keep raw menu items, dialog content, actions and input blocking in state. Presentation plugins own their
  geometry, hit testing and drawing. Entry assignment works independently of the outline drawer.
- Web-ui owns font/color configuration, atlas loading, drawing and GPU resources. Register its configuration
  before plugin setup and project loading. Web-ui animates the presented camera; editor-state commits the logical
  destination and depends on generic grid dimensions.
- Keep raw loading records, contributor-owned errors and assertion results in state. Producers own outcomes and
  presentation plugins own derived geometry and visibility. Replacing a loading ID invalidates older handles.
- Publish `compilerInputRevision` after input changes and consume accepted program artifacts to update
  memory views. Keep accepted metadata in `state.compiler.result` independently of progress. Scheduling, worker
  lifetime and writable memory handles belong to the compiler plugin.

## Editing and Layout

- Route project mutations through the synchronous project editing service. It uses the shared source update path
  to settle facts, configuration, generated environment source and any available layout, then notifies consumers.
  Authored updates and deletions of read-only blocks have no effect; only their owner materializes generated source.
- Keep public edits on `Editor.editing` and view navigation on `Editor.navigation`. Validate command preconditions
  before applying a public batch as one undo step; the compiler validates source syntax and semantics. Internal
  callers obey the typed mutation contract. Use existing block handles for reads and targeting. Keep adapter
  projections outside core and derive positions from source directives.
- Publish `state.projectChange` once after a completed edit, history action or project replacement, after derived
  state settles. Navigation and no-ops leave the revision alone. Share this revision across history, editing and
  persistence, with a separate compiler-input revision. Editing works without the history effect installed.
- Preserve local entry tables, including empty entries, across loading, history, clipboard and serialization.
  Keep remembered viewport and selection in memory. The editor source snapshot owns history, including retained
  draft facts. Reconcile remembered views by owning block identity within each parent, not compiler-facing paths;
  `project/serialization` projects settled source into compiler/file data. Project-save
  owns the text file format.
- Project membership tracks ownership per project level independently of source preparation and layout. The layout
  coordinator uses that membership to publish `codeBlockLayoutsChanged { project, codeBlocks }` after the affected
  blocks settle. Initialize the mutation and rendering services independently; only the dragger owns drag state.
  Consumers refresh the listed blocks and use project identity for view checks.
- Changes to plugin layout contributions rederive affected layouts independently of source edits and compilation.
  Compiler-dependent plugins observe metadata themselves rather than relying on layout recalculation.
  Infer lifecycle payloads from `EditorLifecycleEvents`.

## Input and Drawing

- Route normalized pointer events before default block selection and dragging. UI input layers match drawer
  stages in `INPUT_LAYERS`. Dispatch higher layers first and handlers within each capture or normal phase in
  reverse registration order. Preserve FIFO delivery for unlayered notifications and default effects.
- Draw in registration order within each stage. Web-ui prepares one frame's rendered block geometry for all drawing
  stages, including offscreen blocks. Use its viewport-relative origins for drawing and keep logical editor-state
  geometry for layout and hit testing. Use one block drawer registry in the visible-block traversal and the dedicated
  offscreen callback for offscreen decoration. Draw context menus above canvas overlays and
  dialogs above menus. Modal drawing is independent of `canvasOverlays`.
- Web-ui owns generic render-layer initialization, palette updates, memory release and disposal. Feature plugins
  own prepared glyphs, drawing data and rendering passes, including connector widgets and wires.
- Test against built workspace exports. Use `npx nx run @8f4e/editor-core:test:screenshot` for real-renderer
  viewport and culling coverage.
