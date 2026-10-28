# Session Persistence Plugin

- Own session restoration, JSON storage, and autosave subscriptions here.
- Export `createSessionPersistencePlugin` with inline factory dependencies. Receive storage, storageKey, and
  restoreOnStartup from the host.
- Use the generic `init` hook and `loadProject` action. Keep project serialization and project replacement in core.
- Return explicit cleanup for all subscriptions/listeners. Read and restore storage on init before installing
  autosave subscriptions, then save once. Setup performs no storage I/O. Keep autosaving active regardless of restoreOnStartup.
- Verify with `npx nx run @8f4e/editor-plugin-session-persistence:build|test|typecheck` and
  `npx nx run @8f4e/editor-plugin-session-persistence:test:screenshot`.
