# Editor File Session

- Construct one session per editor. Install its `plugin` before project loaders and pass it to Open and Save.
- Keep only the shared file handle and reset lifecycle here. Clear the handle on `loadProject` and disposal;
  undo/redo retain it. Each editor has its own session.
- Open assigns a handle after successfully reading, parsing, and loading a project. Save owns serialization,
  browser writing, permissions, pending destination, write queue, and stale-completion generation handling.
- Use clean TypeScript output. Verify build/typecheck through Nx; behavior is covered by project-open's composed
  unit/browser tests and the product website's minimal-editor browser tests.
