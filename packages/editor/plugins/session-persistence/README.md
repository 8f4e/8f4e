# Session Persistence Plugin

`@8f4e/editor-plugin-session-persistence` retains the editor's project between instances. The host supplies storage
and the key; the plugin owns JSON reads/writes, restoration, autosave subscriptions, and disposal.

```ts
createSessionPersistencePlugin({
    storage: localStorage,
    storageKey: 'project_editor',
    restoreOnStartup: true,
})
```

Storage needs only `getItem` and `setItem`. The stored value is the compiler-owned `ProjectObjectModel`, serialized
with JSON. The plugin uses the public `serializeToProject` helper to save the entire root project, including nested
groups, even when the editor is displaying a child slice.

When restoration is enabled, setup captures the stored project before core initializes its empty project. The plugin
loads that snapshot through `loadProject` on the generic `init` event. Missing or unreadable storage leaves the initial
project in place; read/write failures are reported in the editor console. Stored object shapes are not validated or
migrated. The host disables restoration when another source has initial-project priority.

Autosaving stays active when `restoreOnStartup` is false. The current subscriptions match the previous core feature:
block-list changes, selected source edits, and programmatic source edits. The `saveSession` action also saves explicitly.
Selection can therefore cause extra saves; project-change signaling remains a separate task in TODO 492.

A pending project URL may leave an empty project saved until fetching succeeds. A failed fetch or closed editor can
leave that empty session persisted. The default composition deliberately accepts this behavior without startup save
coordination. Disposal releases all listeners and subscriptions.

Run the package's `build`, `test`, `typecheck`, and `test:screenshot` Nx targets to verify it.
