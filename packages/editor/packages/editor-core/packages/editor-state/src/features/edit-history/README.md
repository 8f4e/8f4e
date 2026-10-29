# Edit History Feature

Undo and redo retain independent serialized project snapshots, including persisted editor metadata. Each stack holds
up to ten entries. History stays in memory for the current project.

## Project Changes

Source and metadata mutation handlers call the public `incrementProjectRevision(store)` helper after completing an
operation and publishing its derived state. Multi-block actions announce once; no-op actions do not announce.
Selection, caret movement, and navigation leave `projectRevision` unchanged. Compiler scheduling separately uses
`compilerInputRevision`, which excludes visual metadata.

The history effect subscribes to `projectRevision`. An edit immediately invalidates redo and restarts a one-second
debounce. While pending, the committed snapshot remains the before-state. At commit, the current project is compared
by content with that snapshot. Changed content adds one undo step; returning to the committed content adds none.
Snapshots are deep copies because serialization can share live code arrays.

## Explicit Edits and Restoration

- Undo and redo commit pending edits first, so an edit undone immediately can still be redone.
- `applyProjectEdit` commits pending human edits and records the API batch as its own immediate undo step.
  Identical-content batches leave history and persistence unchanged.
  This action remains available when `featureFlags.historyTracking` is disabled, without recording history.
- Undo, redo, and API edits restore through `initialProjectState` within the current project. They preserve the file
  association and do not dispatch `loadProject`.
- `initialProjectState` changes cancel pending work and rebase the committed snapshot after rendering and generated
  blocks have updated. Restoration creates no ordinary edit entry and preserves the remaining redo stack.
- An unrelated `loadProject` clears both stacks and pending work before replacing the project.
- Disposal cancels pending work and removes the effect's listeners and subscriptions.

The session-persistence plugin subscribes to `projectRevision` for edits and `initialProjectState` for loads and
restorations. It saves once after startup restoration, then saves completed project changes without reacting to
selection or navigation.
