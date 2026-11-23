# Edit History Feature

Undo and redo retain detached authored editor source snapshots, including block boundaries, identities, entries, and last
valid grid positions even during incomplete edits. These are not compiler/file projections; the managed root environment,
rendering and view state are not captured. Each stack holds up to ten entries. History stays in memory for the current project.

## Shared Project Changes

`state.projectChange` is the single completed-change record used by API concurrency checks, history, and session
persistence. It contains a monotonic `revision`, a `kind` describing the operation and, for edits, a `history` policy:

| Kind | Operation | History behavior |
| --- | --- | --- |
| `edit`, `history: 'debounced'` | Completed source or metadata mutation | Clear redo immediately and debounce one undo step for one second |
| `edit`, `history: 'skip'` | Skipped authored mutation | Preserve redo and any pending history timer and before-state; rebase an idle baseline |
| `edit`, `history: 'skip'`, `generatedOnly: true` | Only generated source changed | Leave history and its baseline entirely untouched |
| `edit`, `history: 'checkpoint'` | Validated API edit batch | Record one immediate undo step after committing pending human edits |
| `restore` | Undo or redo snapshot | Rebase the current snapshot and retain the remaining stacks |
| `replace` | Opening or creating a project | Cancel pending edits and clear both stacks |

The project editing service owns mutation publication after source, generated source and derived state settle.
Mixed and multi-block transactions announce once; no-op transactions do not announce.
Selection, caret movement, and navigation leave the record unchanged.

Source edit callers can choose `{ history: 'skip' }` to avoid an independent undo step. While no authored edit is
pending, the completed skipped state becomes the next edit's baseline. While an authored edit is pending, its original
before-state and timer remain intact; generic skipped source can be captured together with the pending edit. Skipping does
not promise that an arbitrary source change survives restoring an older snapshot. Managed environment changes are
automatically skipped when they are the only change, with `generatedOnly: true` indicating that the authored snapshot
does not need recapturing. Generated source is excluded from authored snapshots even when it settles in the same
batch as a recorded edit. Skipped edits still publish revisions, settle layout and compile as needed, and participate
in persistence.

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
`beforeProjectEdit` only for actual authored changes before applying the checkpoint batch. History listens to the before-event
to commit pending typing and the completed change record to retain the checkpoint. No-op batches emit neither notification.
The generated environment is read-only at a fixed origin, so attempted source edits do not commit pending typing.
API edits preserve live block identity and work independently of whether the history effect is installed.

Project loading translates the compiler/file projection into an editor source tree. History restores its own editor
snapshot directly through the same project editing service. It captures the current view before same-project
reconstruction, regenerates the managed root environment at the origin from current configuration,
and publishes a single completed change after source and synchronous generated changes have settled.
Viewport placement follows synchronous project-change subscribers and their layout contributions. Undo, redo, and
API batches preserve the file association within the current project. Unrelated replacements dispatch `loadProject`
and publish a `replace` change.

The session-persistence plugin subscribes only to `projectChange`. It saves once after startup restoration, then
saves once per completed project change. History also observes this record for completed changes. Disposal cancels pending
history work and removes owned listeners and subscriptions.
