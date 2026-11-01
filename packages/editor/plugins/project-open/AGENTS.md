# Project Open Plugin

- Own Open From Disk, its main-menu item, and the `importProject` action here.
- Export `createProjectOpenPlugin({ document, fileSession, showOpenMenuItem })` with required browser and session dependencies.
- Read and parse before dispatching `loadProject`, then assign the opened handle to `fileSession.handle`.
  Cancellation and failed parsing retain the current project and association. Pending opens must not load after disposal.
- Keep Save, Export, serialization, permissions, downloads, write ordering, and Cmd/Ctrl+S in project-save.
- Install the session plugin before project loaders. It holds only the shared handle and its reset lifecycle.
- Return cleanup for the action and menu. Keep composed Open/Save integration tests here, including independent
  installation, shared destinations, replacement/disposal, fallbacks, and per-editor isolation. Keep local test helpers local.
- Verify `build`, `test`, `typecheck`, and `test:screenshot` through this package's Nx targets.
