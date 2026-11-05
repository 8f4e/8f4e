# Project Open Plugin

- Own Open From Disk, its main-menu item, and the `importProject` action here.
- Export `createProjectOpenPlugin({ document, fileSession, showOpenMenuItem })` with required browser and session dependencies.
- Read and parse before dispatching `loadProject`, then assign the opened handle to `fileSession.handle`.
  Cancellation and failed parsing retain the current project and association. Pending opens must not load after disposal.
- Keep Save, Export, serialization, permissions, downloads, write ordering, and Cmd/Ctrl+S in project-save.
- Install the session plugin before project loaders. It holds only the shared handle and its reset lifecycle.
- Contribute ID `project-file` and message `Loading project...` while reading, parsing, and installing source.
  Report done/failed outcomes, including callback/action failures; cancel pending work on disposal. Reusing the
  same ID replaces the entry. The presentation plugin owns private visibility.
  Begin after file selection so the picker itself does not show a loading indicator.
- Return cleanup for the action and menu. Keep Open tests independent of Save. Verify parsing, file association, cancellation, fallbacks, disposal,
  and menus here; composed Open/Save and shared-session lifecycle tests belong to editor-default. Keep test helpers local.
- Verify `build`, `test`, and `typecheck` through this package's Nx targets.
