# Code Blocks Feature

## Purpose

Manages the lifecycle of code blocks in the editor: creation, selection, drag operations, deletion, and visual representation. Code blocks are the primary building blocks of 8f4e programs, containing code and metadata that determine how they are compiled and rendered.

## Key Behaviors

- **Block Lifecycle**: Creates, updates, and deletes code blocks
- **Selection**: Tracks which block is currently selected for editing
- **Drag Operations**: Handles repositioning blocks in the viewport
- **Graphics Derivation**: Computes visual properties (position, size, color) from block data
- **Block Widgets**: Derives interactive elements from code annotations:
  - Inputs/Outputs for audio routing

Switch, button, and waveform features are provided by `@8f4e/editor-plugin-switch`, `@8f4e/editor-plugin-button`, and
`@8f4e/editor-plugin-wave`, included in `@8f4e/editor-default`. Their plugins own derived data and drawing through the
[plugin API](../../../../../README.md#plugins), with switch and button plugins also owning their interactions. Meter, plot, bars, watch, stack, crossfade, piano, and
slider also live in their own `@8f4e/editor-plugin-<name>` packages. Core carries no derived data or drawers for these
features; the default composition selects and installs them.

Favorite/Unfavorite editing and Remove connections are provided by `@8f4e/editor-plugin-toggle-favorite` and
`@8f4e/editor-plugin-remove-memory-connections`. They own their action handlers and block-menu contributions.
Core still derives `isFavorite` from directives and provides favorite navigation; generic directive editing remains
available through the public `removeDirective` helper.

Visual grouping through `; @group <name> [nonstick]` belongs to `@8f4e/editor-plugin-grouping`, including group menus,
actions, drag-target selection, and paste collision renaming. Membership stays private to that plugin. Core dispatches
the generic `resolveCodeBlockDragTargets` and `transformPastedCodeBlocks` events before moving or inserting blocks.

## Block Types

Code blocks are categorized by type, which determines compilation and rendering behavior:

- **`module`** - Top-level code modules compiled as standalone units
- **`function`** - Function definitions compiled separately
- **`constants`** - Constant definitions (compiled as modules)
- **`note`** - Editor-only notes
- **`unknown`** - Unclassified blocks (fallback)

Block types are automatically detected and updated based on code content.

## Subfeatures

This feature contains several subfeatures under `features/` that handle specific aspects:

- `blockHighlights` - Visual highlighting for selected/hovered blocks
- `blockTypeUpdater` - Automatic block type detection and updates
- `codeBlockCreator` - Block creation logic
- `codeBlockDragger` - Drag and drop operations
- `codeBlockNavigation` - Keyboard navigation between blocks
- `codeBlockRendering` - Visual properties computation
- `inputs` - Audio input routing
- `outputs` - Audio output routing

## Events & Callbacks

### Key Events

- `createCodeBlock({ x, y, blockType })`: create a template of the requested type
- `pasteCodeBlocks({ x, y })`: read and insert clipboard content, including multiple blocks
- `insertCodeBlock({ x, y, code })`: insert supplied source lines
- `resolveCodeBlockDragTargets({ codeBlock, altKey, targets })`: synchronously replace the blocks core will drag
- `transformPastedCodeBlocks({ blocks })`: synchronously replace an incoming clipboard batch before insertion
- `refreshCodeBlockLayouts()`: rederive the visible slice after late directive registration without a project edit
- Block deletion and selection events
- Drag start/update/end events
- Block type update events

### State Touched

- `state.codeBlockRendering.rootCodeBlocks` - Recursive root tree of project-owned code-block arrays
- `state.codeBlockRendering.codeBlocks` - Direct pointer to the project slice currently rendered
- `state.codeBlockRendering.selectedCodeBlock` - Currently selected block reference
- Block-specific properties: position, size, color, blockType, code, cursor, widgets (inputs/outputs)

Project-group blocks use the same `CodeBlockGraphicData` representation as other blocks. Their optional
`nestedProjectCodeBlocks` field points to the child project slice. Project-owned arrays keep stable identity; add,
delete, paste, and reorder operations replace their contents in place so the root tree and rendered-slice pointer do
not diverge. Loading a project rebuilds the recursive tree and resets `codeBlocks` to `rootCodeBlocks`.
Project-group blocks expose an **Open group** context-menu action that points `codeBlocks` directly at their child
slice. Nested-slice context menus expose **Go back**, which finds the immediate parent through those stable array
references.

`@8f4e/editor-plugin-assertion-markers` owns assertion site aggregation, geometry, and drawing over line numbers.
It reads `state.assertionResults` and current block layout through the generic drawer hook. Core block state
contains no marker rectangles.

Failed assertions use the inline error-message widget independently of the marker plugin. The runtime can provide a formatted `message` with
expected and received values; outcomes without a message display `Assertion failed`. One message is shown per
source site, using its first failed invocation. Messages match compiler block IDs and project paths,
clear with results or compilation start, and contribute space below the assertion through the existing error layout.

## Integration Points

- **Compiler**: Blocks are sorted by `creationIndex` and filtered by type for compilation
- **Viewport**: Block positions are in viewport coordinates
- **Edit History**: Block changes trigger history snapshots

Memory references use the `MemoryScope` type exported through `@8f4e/editor-state/memory`. A module scope
(`{ kind: 'module', moduleId }`) resolves unqualified names in that module's declarations. A project scope
(`{ kind: 'project', groupPath }`) resolves unqualified names in the group's exposed aliases; the root project uses
the empty group path. Qualified names resolve relative to the scope's project path, while paths containing `/` are
canonical. Local module declarations and group exposures remain distinct even when a module and group share a name.

Widgets, connectors, and other code-block consumers use `getCodeBlockMemoryScope` to convert graphical blocks at the
editor boundary. Configuration and renderer consumers construct scopes from their known project paths or canonical
module IDs. `resolveMemoryTarget` handles target lookup using these explicit scopes, and `resolveMemoryIdentifier`
adds address operators, dereferencing, and indexing. The watch plugin owns binary/hex formatting prefixes and
end-address display syntax. The resolvers accept no graphical blocks or implicit string scopes.

## References

- See `utils/` for block manipulation helpers
- See `features/` subdirectories for detailed subfeature implementations
- See `../../../../../docs/editor-directives.md` for editor-only directive syntax (`; @...`) and supported directives
