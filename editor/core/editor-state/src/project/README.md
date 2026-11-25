# Project and code blocks

## Purpose

Manages the lifecycle of code blocks in the editor: creation, selection, drag operations, deletion, and visual representation. Code blocks are the primary building blocks of 8f4e programs, containing code and metadata that determine how they are compiled and rendered.

## Key Behaviors

- **Block Lifecycle**: Creates, updates, and deletes code blocks
- **Selection**: Tracks which block is currently selected for editing
- **Drag Operations**: Handles repositioning blocks in the viewport
- **Graphics Derivation**: Computes visual properties (position, size, color) from block data
- **Layout Contributions**: Applies plugin requests for additional rows and minimum width

`@8f4e/editor-plugin-error-messages` owns inline message wrapping, row reservations, and drawing. Core stores raw
errors in contributor-owned `state.codeErrors` lists and applies generic layout contributions.

Nested language-block highlighting belongs to `@8f4e/editor-plugin-code-rendering`, including its tolerant parser,
background colors, rectangle geometry, and private cache. Core supplies block/display bounds, grid dimensions, and gaps.

`@8f4e/editor-plugin-connectors` owns input/output connector sprites, and `@8f4e/editor-plugin-wires` independently
owns wire layout and drawing. Both use the editor's group exposure rows and the compiler's resolved targets.
Core retains no widget presentation data; language semantics stay in the compiler.

Switch, button, and waveform features are provided by `@8f4e/editor-plugin-switch`, `@8f4e/editor-plugin-button`, and
`@8f4e/editor-plugin-wave`, included in `@8f4e/editor-default`. Their plugins own derived data and drawing through the
[plugin API](../../../editor-core/README.md#plugins), with switch and button plugins also owning their interactions. Meter, plot, bars, watch, stack, crossfade, piano, and
slider also live in their own `@8f4e/editor-plugin-<name>` packages. Core carries no derived data or drawers for these
features; the default composition selects and installs them.

Favorites and Remove connections are provided by `@8f4e/editor-plugin-favorites` and
`@8f4e/editor-plugin-remove-memory-connections`. They own their action handlers and block-menu contributions.
The favorites plugin reads cached directives and owns its navigation submenu. Core exposes generic block jumping
and directive editing through public helpers.

Visual grouping through `; @group <name> [nonstick]` belongs to `@8f4e/editor-plugin-grouping`, including group menus,
actions, drag-target selection, and copying. Membership stays private to that plugin. Core dispatches
the generic `resolveCodeBlockDragTargets` event before moving blocks.

## Block Types

Code blocks are categorized by type, which determines compilation and rendering behavior:

- **`module`** - Top-level code modules compiled as standalone units
- **`function`** - Function definitions compiled separately
- **`constants`** - Constant definitions (compiled as modules)
- **`includes`** - Include declarations
- **`note`** - Editor-only notes
- **`group`** - Structural block owning a child project level
- **`unknown`** - Unclassified blocks (fallback)

Document block types are automatically detected and updated based on code content without replacing the block.
Groups retain their structural type even when the wrapper source is incomplete or malformed. An incomplete
declaration retains its last execution entry; a completed non-execution block clears it. Converting that block back to
a module uses an explicitly assigned entry or `main`. Empty authored entry sections remain part of the project.

## Source Organization

The project and its related editor-state domains handle specific aspects:

- `insertCodeBlock.ts` - Generic positioned source insertion
- `../input/blockDragging.ts` - Drag and drop operations
- `../input/blockNavigation.ts` - Keyboard navigation between blocks
- `../layout/trackBlockLayout.ts` - Visual properties and cursor geometry

New block templates, random names, Delete, and their menu contributions belong to `editor-plugin-block-authoring`.
The `toggle-disabled` plugin owns the Enable/Disable action; `log-block-info` owns console inspection.
Core still interprets the authored `@disabled` directive.
Core retains insertion/removal helpers, entry assignment, identity allocation, folding, layout, and authored snapshot
capture and restoration. The undo-redo plugin owns edit history and its policy.

Source changes use `blocks/refreshSourceMetadata.ts` to parse directives and retain their block flags and display facts, update
block type and valid grid coordinates, and settle stacking. The project transaction service owns synchronous mutation
transactions and coordinates source normalization, global configuration, generated environment source and layout.
Source facts and compiler inputs settle without
pixel geometry. Layout builds display rows from the retained facts and current selection without rerunning directive
handlers. An incomplete or invalid position directive retains the existing block position. Interactive and programmatic
edits use this same path; ordinary layout invalidations do not reparse source. Project membership tracks each block's owning
`ProjectLevel`, independently of source preparation and layout calculations. The ownership index is rebuilt on project
loading and block-collection changes. Navigating between existing levels refreshes layout without changing source
or global configuration. Renaming a group retains its runtime identity while updating its source path.
Editor-state initialization constructs membership, the layout coordinator and the project transaction service separately;
the block layout handlers consume the coordinator for layout and selection without owning source mutation. The dragger owns
its transient gesture state and cancels the entire gesture when the active project collection changes.

The coordinator queues changed blocks by owning group, settles nested plugin contributions, and projects grid
positions to world pixels before publishing completion for each affected group. Pixel layout waits for the first
positive grid dimensions; while a replacement grid is pending, the previously installed grid remains usable. Panning and resizing do not move
blocks in the project. Other blocks can still be in the middle of a source update and must not be read as part of a
completion notification.

## Events & Callbacks

### Key Events

- `resolveCodeBlockDragTargets({ codeBlock, altKey, targets })`: synchronously replace the blocks core will drag
- `state.projectChange`: reports completed project mutations after metadata, configuration, generated source and
  available layout settle
- `codeBlockLayoutContributionsChanged({ codeBlock? })`: internal invalidation; rederives a changed block in its owning
  group, or the current group when no block is supplied
- `codeBlockLayoutsChanged({ level, codeBlocks })`: identifies one owning level and its completed source/display rows,
  contributions, and positions. Rendering prepares only the listed blocks; active-view consumers compare `level`
  with `activeLevel`. Empty groups still publish a completion when navigation replaces the visible slice.
- Block deletion and selection events
- Drag start/update/end events
- Block type update events

### State Touched

- `state.project.rootLevel` - Recursive root project level
- `state.project.activeLevel` - Direct reference to the project level currently rendered
- `state.project.selectedCodeBlock` - Currently selected block reference
- Block-specific properties: position, size, blockType, code, cursor, display rows, and gaps

Project-group blocks use the same `EditorCodeBlock` representation as other blocks. Their optional
`childLevel` field owns a `ProjectLevel` with its canonical `path`, `blocks`, local `entries`, optional remembered
`viewport`, and `selectedBlock`.
`rootLevel` owns the recursive tree; `activeLevel` refers directly to the level being rendered. Group navigation
finds a parent level by the block that owns the child level, comparing the child level by object identity.
Groups with identical name paths therefore remain distinct navigation targets; the paths are used for compiler-facing
source data, not navigation identity.

`reconstruction.ts` builds graphical project trees and transfers remembered views, selections, and existing
positions for same-project edits. The project transaction service installs the result and owns selection reset, layout/source
refresh coordination, and compiler-input notifications.

Core retains the selected source row/column, pointer-to-source mapping, and shared vertical coordinates for line
highlighting, tooltips, viewport centering, and navigation. The keyboard-editing plugin owns caret movement and
presentation, including horizontal placement derived from shared tab/source geometry.

**Open group**, **Go back**, and root navigation save the departing level's position and restore the destination's
remembered position and selected block. If the group block was selected before entry, returning reselects it.
Reopening a group also restores its last selection. An explicitly cleared selection stays cleared, and deleted blocks
are not restored. A remembered position always takes precedence, including a remembered origin.
Project restoration captures the departing view for same-project edits and requests placement once after the
project change and synchronous layout contributions settle. Only first visits resolve the initial viewport through
the `resolveInitialProjectViewport` event. Core defers this request while the selected grid is pending and applies
the synchronous plugin contribution once the grid is installed. A level left before placement remains unvisited, and manual navigation
takes precedence over pending placement. Without a contributed position, the viewport starts at `(0, 0)`. Positions live only
in browser memory together with remembered selections: project serialization, clipboard payloads, and session storage
exclude both. Same-project edits and undo/redo transfer remembered views and selections to rebuilt levels, resolving
selections to the new live blocks. They preserve the active level, falling back to the root if that level was removed.
Loading a different project creates fresh levels without remembered views or selections. Switching levels stops
the presented camera in web-ui; navigating to the current level leaves its view and selection alone.

`@8f4e/editor-plugin-assertion-markers` owns assertion site aggregation, geometry, and drawing over line numbers.
It reads `state.assertionResults` and current block layout through the generic drawer hook. Core block state
contains no marker rectangles.

Test-runtime publishes the first failed invocation of each source assertion as a raw error under
`codeErrors.test-runtime`, including expected and received values. It excludes included/unowned sites and disabled
blocks, and clears its errors when execution restarts. Error-messages displays those errors independently of the
marker plugin through the same contribution path as other source errors.

## Integration Points

- **Compiler**: Blocks are sorted by `creationIndex` and filtered by type for compilation
- **Viewport**: Block positions are in viewport coordinates
- **Edit History**: Completed project changes notify the optional undo-redo plugin, which captures authored snapshots.

See [memory lookup and access](../memory/README.md) for resolving compiler memory targets and preparing runtime reads.

## References

- See `blocks/` for block manipulation helpers
- See `entries/` and `serialization/` for project entry and serialization implementations
- See `../../../editor-core/docs/editor-directives.md` for editor-only directive syntax (`; @...`) and supported directives

See [layout contributions](../layout/README.md) for how plugins reserve space within blocks.

Block copy/paste menus and browser clipboard access are owned by `editor-plugin-code-block-copy-paste`. Core exports `insertCodeBlocks` for positioned source batches and pure `serializeCodeBlocks` for portable source data. Insertion preserves names and references and rewrites only `@pos`.
