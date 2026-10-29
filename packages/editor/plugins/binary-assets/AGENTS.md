# Binary Assets Plugin

- Own `bin` configuration, fetching, CacheStorage access, private asset bytes/metadata, runtime memory writes,
  loading-dialog state, and generated `ASSET_<ID>_SIZE` source here.
- Export `createBinaryAssetsPlugin({ getMemoryBytes })` with inline dependency types. Both editor compositions load
  it lazily from raw `bin` configuration and supply current memory bytes; fetching and caching remain inside this plugin.
- Keep browser resources out of the shared plugin context. Use public memory resolution and generic schema,
  dialog, and environment-constant contribution mechanisms.
- Keep binary asset types and state private. Core must not reference binary assets or asset-generated constants.
- Ignore stale fetch results after configuration changes or disposal. Unsubscribe and remove owned contributions
  and dialogs on disposal.
- Verify with `npx nx run @8f4e/editor-plugin-binary-assets:build|test|typecheck` and
  `npx nx run @8f4e/editor-plugin-binary-assets:test:screenshot` for the loading dialog and real editor integration.
