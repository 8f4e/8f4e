# Edit History Feature

Undo and redo retain detached editor source snapshots, including block boundaries, identities, entries, and last
valid grid positions even during incomplete edits. These are not compiler/file projections; rendering and view state
are not captured. Each stack holds up to ten entries. History stays in memory for the current project.

## Shared Project Changes

`state.projectChange` is the single completed-change record used by API concurrency checks, history, and session
persistence. It contains a monotonic `revision` and a `kind` describing the operation:

| Kind | Operation | History behavior |
| --- | --- | --- |
| `edit` | Completed source or metadata mutation | Clear redo immediately and debounce one undo step for one second |
| `checkpoint` | Validated API edit batch | Record one immediate undo step after committing pending human edits |
| `restore` | Undo or redo snapshot | Rebase the current snapshot and retain the remaining stacks |
| `replace` | Opening or creating a project | Cancel pending edits and clear both stacks |

The project editing service owns mutation publication after source, generated source and derived state settle.
Mixed and multi-block transactions announce once; no-op transactions do not announce.
Selection, caret movement, and navigation leave the record unchanged.

The editing handle creates its opaque revision token from its instance identity and this shared revision. It keeps
no separate content fingerprint or revision subscriptions. A load invalidates old tokens even when the newly opened
project has identical content. Undo and redo advance the revision while returning to earlier source content.

Compiler scheduling independently uses `compilerInputRevision`, which excludes visual metadata. A compiler-only
revision change does not create a project revision, autosave, or history entry.

## Snapshots and Restoration

While an ordinary edit is pending, the committed snapshot remains the before-state. At commit, the current project
is compared by content with that snapshot. Changed content adds one undo step; returning to the committed content
adds none. Snapshots copy source lines and use canonical spatial/creation order so transient z-order does not add
history. Allocation without a net source change adds no step; the creation counter is never rewound within the project.

Undo and redo commit pending edits first, so an edit undone immediately can still be redone. The public API uses
the project editing service for a live mutation batch with checkpoint history policy. The service emits
`beforeProjectEdit` only for actual changes before applying the batch. History listens to the before-event to commit
pending typing and the completed change record to retain the checkpoint. No-op batches emit neither notification.
API edits preserve live block identity and work independently of whether the history effect is installed.

Project loading translates the compiler/file projection into an editor source tree. History restores its own editor
snapshot directly through the same project editing service. It captures the current view before same-project
reconstruction, regenerates the managed root environment from current configuration and the historical position,
and publishes a single completed change after source and synchronous generated changes have settled.
Viewport placement follows synchronous project-change subscribers and their layout contributions. Undo, redo, and
API batches preserve the file association within the current project. Unrelated replacements dispatch `loadProject`
and publish a `replace` change.

The session-persistence plugin subscribes only to `projectChange`. It saves once after startup restoration, then
saves once per completed project change. History also subscribes only to this record. Disposal cancels pending
history work and removes owned listeners and subscriptions.
