# Edit History Feature

Undo and redo retain independent serialized project snapshots, including persisted editor metadata. Each stack holds
up to ten entries. History stays in memory for the current project.

## Shared Project Changes

`state.projectChange` is the single completed-change record used by API concurrency checks, history, and session
persistence. It contains a monotonic `revision` and a `kind` describing the operation:

| Kind | Operation | History behavior |
| --- | --- | --- |
| `edit` | Completed source or metadata mutation | Clear redo immediately and debounce one undo step for one second |
| `checkpoint` | Validated API edit batch | Record one immediate undo step after committing pending human edits |
| `restore` | Undo or redo snapshot | Rebase the current snapshot and retain the remaining stacks |
| `replace` | Opening or creating a project | Cancel pending edits and clear both stacks |

Source and metadata mutation handlers call the public `publishProjectChange(store)` helper after completing an
operation and publishing its derived state. Multi-block actions announce once; no-op actions do not announce.
Selection, caret movement, and navigation leave the record unchanged.

The editing handle creates its opaque revision token from its instance identity and this shared revision. It keeps
no separate content fingerprint or revision subscriptions. A load invalidates old tokens even when the newly opened
project has identical content. Undo and redo advance the revision while returning to earlier source content.

Compiler scheduling independently uses `compilerInputRevision`, which excludes visual metadata. A compiler-only
revision change does not create a project revision, autosave, or history entry.

## Snapshots and Restoration

While an ordinary edit is pending, the committed snapshot remains the before-state. At commit, the current project
is compared by content with that snapshot. Changed content adds one undo step; returning to the committed content
adds none. Serialization returns detached canonical models, so history retains them directly and compares their
JSON without additional cloning or object-key sorting.

Undo and redo commit pending edits first, so an edit undone immediately can still be redone. The project-operations
effect owns `applyProjectEdit`: it compares the canonical API draft with current serialized content, emits
`beforeProjectEdit` for changed drafts, then restores the batch as a checkpoint. History listens to the before-event
to commit pending typing and the completed change record to retain the checkpoint. Identical-content batches emit
neither notification, preserving pending edits, revisions, history, and persistence. Project operations apply API
edits independently of whether the history effect is installed or `featureFlags.historyTracking` is enabled.

Project loading, API operations, and history use the shared `restoreProject` helper to install `initialProjectState`.
It publishes a single change after rendering and generated environment constants have updated, suppressing intermediate edit
notifications during restoration. Undo, redo, and API batches preserve the file association within the current
project. Unrelated replacements dispatch `loadProject` and publish a `replace` change.

The session-persistence plugin subscribes only to `projectChange`. It saves once after startup restoration, then
saves once per completed project change. History also subscribes only to this record. Disposal cancels pending
history work and removes owned listeners and subscriptions.
