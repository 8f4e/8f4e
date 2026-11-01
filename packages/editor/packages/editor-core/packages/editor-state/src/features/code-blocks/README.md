# Code Blocks Feature

## Purpose

Manages the lifecycle of code blocks in the editor: creation, selection, drag operations, deletion, and visual representation. Code blocks are the primary building blocks of 8f4e programs, containing code and metadata that determine how they are compiled and rendered.

## Key Behaviors

- **Block Lifecycle**: Creates, updates, and deletes code blocks
- **Selection**: Tracks which block is currently selected for editing
- **Drag Operations**: Handles repositioning blocks in the viewport
- **Graphics Derivation**: Computes visual properties (position, size, color) from block data
- **Block Widgets**: Derives inline error messages and shape declarations

Input/output connector geometry, private widget data, wire lookup, and the complete GPU line renderer belong to
`@8f4e/editor-plugin-connectors`. Both editor compositions install it through the generic layout and drawing hooks.

Switch, button, and waveform features are provided by `@8f4e/editor-plugin-switch`, `@8f4e/editor-plugin-button`, and
`@8f4e/editor-plugin-wave`, included in `@8f4e/editor-default`. Their plugins own derived data and drawing through the
[plugin API](../../../../../README.md#plugins), with switch and button plugins also owning their interactions. Meter, plot, bars, watch, stack, crossfade, piano, and
slider also live in their own `@8f4e/editor-plugin-<name>` packages. Core carries no derived data or drawers for these
features; the default composition selects and installs them.

Favorites and Remove connections are provided by `@8f4e/editor-plugin-favorites` and
`@8f4e/editor-plugin-remove-memory-connections`. They own their action handlers and block-menu contributions.
The favorites plugin reads cached directives and owns its navigation submenu. Core exposes generic block jumping
and directive editing through public helpers.

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
- `codeBlockCreator` - Block creation logic
- `codeBlockDragger` - Drag and drop operations
- `codeBlockNavigation` - Keyboard navigation between blocks
- `codeBlockRendering` - Visual properties computation
- `inputs` - Audio input routing
- `outputs` - Audio output routing

Source changes use `sourceUpdates.ts` in an explicit sequence: parse directives and update block type and valid grid
coordinates, regenerate environment source, resolve global configuration, then refresh layouts. An incomplete or
invalid position directive retains the existing block position. Interactive and programmatic edits use this same
path; ordinary layout invalidations do not reparse source.

## Events & Callbacks

### Key Events

- `createCodeBlock({ x, y, blockType })`: create a template of the requested type
- `pasteCodeBlocks({ x, y })`: read and insert clipboard content, including multiple blocks
- `insertCodeBlock({ x, y, code })`: insert supplied source lines
- `resolveCodeBlockDragTargets({ codeBlock, altKey, targets })`: synchronously replace the blocks core will drag
- `transformPastedCodeBlocks({ blocks })`: synchronously replace an incoming clipboard batch before insertion
- `codeBlockLayoutContributionsChanged({ codeBlock? })`: internal contribution invalidation; rederives affected visible blocks
- `codeBlockLayoutsChanged()`: announces completed layout calculations to rendering and viewport anchoring
- Block deletion and selection events
- Drag start/update/end events
- Block type update events

### State Touched

- `state.codeBlockRendering.rootProject` - Recursive root project level
- `state.codeBlockRendering.currentProject` - Direct reference to the project level currently rendered
- `state.codeBlockRendering.selectedCodeBlock` - Currently selected block reference
- Block-specific properties: position, size, color, blockType, code, cursor, widgets (inputs/outputs)

Project-group blocks use the same `CodeBlockGraphicData` representation as other blocks. Their optional
`childProject` field owns a `ProjectLevel` with its canonical `path`, `blocks`, local `entries`, optional remembered
`viewport`, and `selectedBlock`.
`rootProject` owns the recursive tree; `currentProject` refers directly to the level being rendered. Shared tree helpers
resolve levels and parents by path, without recovering identity from block arrays.

**Open group**, **Go back**, and root navigation save the departing level's position and restore the destination's
remembered position and selected block. If the group block was selected before entry, returning reselects it.
Reopening a group also restores its last selection. An explicitly cleared selection stays cleared, and deleted blocks
are not restored. A remembered position always takes precedence over `@home`, including a remembered origin.
Only first visits use the first `@home` block (including its alignment), or `(0, 0)` if none exists. Positions live only
in browser memory together with remembered selections: project serialization, clipboard payloads, and session storage
exclude both. Same-project edits and undo/redo transfer remembered views and selections to rebuilt levels, resolving
selections to the new live blocks. They preserve the active level, falling back to the root if that level was removed.
Loading a different project creates fresh levels without remembered views or selections. Switching levels stops
active viewport animations; navigating to the current level leaves its view and selection alone.

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

## Layout Contributions

The independent `store.layout` service owns contributions and subscriptions. Plugins submit complete space/minimum-width
requests through `createContribution().update(block, value)` and subscribe to calculated blocks with `layout.subscribe`.
A subscription can update its own requests; unchanged values do not trigger another calculation. Core processes changed
requests synchronously and refreshes rendered text after layouts settle. Directive drafts contain only block/display
semantics. Match live blocks with `matchEditorDirectives(codeBlock.parsedDirectives, definitions)`. Core updates
records on source changes and retains unknown directives for late plugins. Raw-source parsing remains available
through `parseBlockDirectives` for incoming source and whole-project scans. Standalone and trailing directives share
the same syntax; matching preserves source context and normalizes aliases.
