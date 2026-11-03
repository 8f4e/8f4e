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

On the generic `init` event, the plugin reads and restores the saved project through `loadProject`, then installs
its autosave subscriptions and saves the resulting project once. Setup performs no storage I/O. Missing or unreadable
storage leaves core's initial project in place; read/write failures are reported in the editor console. Stored object
shapes are not validated or migrated. The host disables restoration when another source has initial-project priority.

Autosaving starts after initialization regardless of `restoreOnStartup`. It subscribes to block-list changes, selected
source edits, and programmatic source edits. Selection can therefore cause extra saves; project-change signaling remains
a separate task in TODO 492.

A pending project URL may leave an empty project saved until fetching succeeds. A failed fetch or closed editor can
leave that empty session persisted. The default composition deliberately accepts this behavior without startup save
coordination. Disposal releases all listeners and subscriptions.

Run the package's `build`, `test`, `typecheck`, and `test:screenshot` Nx targets to verify it.
