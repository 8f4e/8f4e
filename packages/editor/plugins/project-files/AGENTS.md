# Project Files Plugin

- Own Open From Disk, Save, Export Project, their actions/menus, and Cmd/Ctrl+S here.
- Export `createProjectFilesPlugin({ inputTarget, showOpenMenuItem })` with inline factory dependencies.
- Derive browser resources from the input element's ownerDocument. Own file associations, permissions, input/download
  fallbacks, pending destinations, and ordered writes inside each setup. The default editor supplies no file service.
- Dispatch generic `loadProject` after parsing an opened file; observe that action to clear old associations. Undo/redo
  restore state within the existing project. Keep file-specific callbacks, flags, and handles out of core.
- Start pickers and permission requests synchronously from user actions. Accepted writes may finish after disposal;
  pending opens must not replace the disposed editor's project.
- Use public serialization and logging helpers. Session persistence belongs to its separate plugin.
- Return explicit cleanup for DOM listeners, actions, and menu contributions.
- Verify `build`, `test`, `typecheck`, and `test:screenshot` through this package's Nx targets.
