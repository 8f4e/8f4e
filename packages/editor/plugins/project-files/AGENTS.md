# Project Files Plugin

- Own Open From Disk, Save, their actions/menus, and Cmd/Ctrl+S here. Export Project belongs to its separate plugin.
- Export `createProjectFilesPlugin({ inputTarget, fileSession, showOpenMenuItem })` with required session injection.
- Derive Open's browser resources from the input element's ownerDocument. Parse before dispatching `loadProject`,
  then associate the opened handle through the shared file session. Cancellation and failed parsing retain it.
- The composition installs the file session's plugin before project loaders. Keep associations, permissions,
  pending destinations, ordered writes, and downloads in `@8f4e/editor-file-session`, outside core.
- Pending opens must not replace a disposed editor's project. Return cleanup for DOM listeners, actions, and menus.
- Keep the composed Open/Save, Export, and shared-session behavior covered here: independent installation, destination
  sharing, serialized writes, replacement/disposal, fallbacks, and per-editor isolation. Keep local test helpers local.
- Verify `build`, `test`, `typecheck`, and `test:screenshot` through this package's Nx targets.
