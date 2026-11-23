# Project Loading

Core owns generic project replacement and New Project. Hosts and plugins dispatch `loadProject` with `{ project }`,
where project is the compiler-owned `ProjectObjectModel`. The project editing service normalizes the generated
root `constants env`, installs the prepared tree and settles source and layout before announcing the replacement.
Modules and groups occupy the same ordered
`execution` sequence; group ids are retained as editor creation indices. Loading an unpositioned group preserves its
source instead of adding a position directive that changes execution order. The `new` action dispatches `loadProject` with
an empty project so plugins can observe the same replacement path.

Undo and redo restore snapshots within the current project. They do not dispatch the action for
loading an unrelated project. The shared restoration flow requests viewport placement once after the completed
project change and synchronous layout contributions. File associations, disk imports, URL fetching, and session
persistence belong to plugins.

`@8f4e/editor-core` loads its `initialProject` option (or an empty project) after the first resize, then awaits
`prepareInitialProject` handlers so that project loading and configuration settle before the selected atlas is loaded.
Generic serialization remains under `pureHelpers/projectSerialization` and is exported by editor-state.
