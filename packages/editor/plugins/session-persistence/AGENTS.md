# Session Persistence Plugin

- Own session restoration, JSON storage, autosave subscriptions, and the saveSession action here.
- Export `createSessionPersistencePlugin` with inline factory dependencies. Receive storage, storageKey, and restoreOnStartup from the host.
- Use the generic `init` hook and `loadProject` action. Keep project serialization and project replacement in core.
- Return explicit cleanup for all subscriptions/listeners. Capture the saved session during setup so generic empty-project initialization cannot erase the restore input. Keep autosaving active regardless of restoreOnStartup.
- Verify with `npx nx run @8f4e/editor-plugin-session-persistence:build|test|typecheck` and
  `npx nx run @8f4e/editor-plugin-session-persistence:test:screenshot`.
