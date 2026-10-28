# Project URL Loader Plugin

- Own initial project URL fetching, HTTP errors, and source parsing here.
- Export `createProjectUrlLoaderPlugin` with inline factory dependencies. Receive fetch and an optional initialProjectUrl from the host.
- Use the generic `init` hook and `loadProject` action. Keep project serialization and project replacement in core.
- Return explicit cleanup for all subscriptions/listeners. Ignore loads that complete after disposal. Keep initial URL priority in the default composition.
- Verify with `npx nx run @8f4e/editor-plugin-project-url-loader:build|test|typecheck` and
  `npx nx run @8f4e/editor-plugin-project-url-loader:test:screenshot`.
