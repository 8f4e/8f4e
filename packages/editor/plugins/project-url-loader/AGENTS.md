# Project URL Loader Plugin

- Own initial project URL fetching, HTTP errors, and source parsing here.
- Export `createProjectUrlLoaderPlugin` with inline factory dependencies. Receive fetch and an optional initialProjectUrl from the host.
- Use the awaited, pre-render `init` hook and `loadProject` action. Return the loading promise so rendering waits for
  fetching and parsing alongside font loading. Keep project serialization and project replacement in core.
- Accept optional onLoaded/onError factory callbacks. Notify after source installation, treat valid empty source as
  success, and suppress notifications after disposal. Keep callback and project-replacement errors outside the I/O catch.
- Contribute `{ name: 'project' }` through `loading.add` while fetching/reading, parsing, and installing source.
  Remove only owned indicators on success, failure, and disposal; callback/action errors must also release them.
  Initial URL loading still precedes the first canvas frame; the contribution does not change startup rendering.
- Return explicit cleanup for all subscriptions/listeners. Ignore loads that complete after disposal. Keep initial URL priority in the host composition.
- Verify with `npx nx run @8f4e/editor-plugin-project-url-loader:build|test|typecheck` and
  `npx nx run @8f4e/editor-plugin-project-url-loader:test:screenshot`.
