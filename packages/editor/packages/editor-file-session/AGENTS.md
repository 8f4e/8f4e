# Editor File Session Guidelines

- Store only the editor's shared file handle and reset lifecycle. Clear the handle on `loadProject` and
  disposal. Undo and redo retain it.
- Open assigns a handle after successfully loading a project. Save owns browser writes and destination
  coordination. Exercise the shared lifecycle in composition tests.
