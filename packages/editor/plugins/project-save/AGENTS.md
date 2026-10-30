# Project Save Plugin

- Own Save, Export Project/Save As, Cmd/Ctrl+S, source serialization, filename selection, and error reporting here.
- Export `createProjectSavePlugin({ inputTarget, fileSession })`. Derive browser resources from the input's ownerDocument.
- Keep `serializeProjectTo8f4e` and browser save/download helpers private to this package. Core's `serializeToProject`
  supplies the detached project model; its public filename and logging helpers remain shared with other features.
- Own the pending destination, write queue, and generation in setup. Reset pending destination/generation on
  `loadProject` and disposal. The shared file session holds only the handle and clears it on replacement/disposal.
- Start pickers and permissions in the user gesture. Order writes; accepted writes may finish after replacement or
  disposal, but cannot adopt an old destination afterward. Export selects the file used by later saves.
- Return cleanup for actions, menu, and keyboard listener. Open/parsing belongs to project-open.
- Use clean TypeScript output. Verify build/test/typecheck through Nx. Unit tests cover source formatting; composed
  file behavior is covered by project-open tests and the product website's minimal-editor browser suite.
