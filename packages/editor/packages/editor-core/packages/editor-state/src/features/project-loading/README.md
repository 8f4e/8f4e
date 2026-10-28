# Project Loading

Core owns generic project replacement and New Project. Hosts and plugins dispatch `loadProject` with `{ project }`,
where project is the compiler-owned `ProjectObjectModel`. The action sets `state.initialProjectState`; block effects
populate the project and compilation follows its normal subscriptions. The `new` action dispatches `loadProject` with
an empty project so plugins can observe the same replacement path.

Undo and redo restore `initialProjectState` directly within the current project. They do not dispatch the action for
loading an unrelated project. File associations, disk imports, URL fetching, and session persistence belong to plugins.

`@8f4e/editor-core` loads its `initialProject` option (or an empty project) after the first resize, then emits `init`.
Generic serialization remains under `pureHelpers/projectSerialization` and is exported by editor-state.
