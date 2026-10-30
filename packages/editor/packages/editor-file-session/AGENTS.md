# Editor File Session

- Construct one session per editor. Install its `plugin` before project loaders and pass it to file plugins.
- Keep the session to the file handle, pending destination, write queue, and generation used to reset associations.
  It takes no document or editor state. Keep project serialization, filename policy, and logging in the file plugins.
- The separate `writeProjectFile` browser helper accepts a Blob and filename; it coordinates writes through that
  session. Keep Open parsing and the file input in project-files, and menus/actions in their feature plugins.
- Reset association on `loadProject` and disposal; undo/redo retain it. Accepted writes may finish after replacement
  or disposal, but must not associate an old destination with the replacement project.
- Start pickers and permissions synchronously in the user gesture, before queued writes. Export acts as Save As.
- Use clean TypeScript output. Verify build/typecheck through Nx; behavior is covered by project-files composed
  unit/browser tests and the product website's minimal-editor browser tests.
