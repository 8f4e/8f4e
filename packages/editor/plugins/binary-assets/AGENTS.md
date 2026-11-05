# Binary Assets Plugin

- Own `bin` configuration, fetching, CacheStorage access, private asset bytes/metadata, runtime memory writes,
  loading-indicator lifecycle, and generated `ASSET_<ID>_SIZE` source here.
- Export `createBinaryAssetsPlugin({ getMemoryBytes })` with inline dependency types. For lazy installation, match raw `bin`
  configuration with project scope and supply current memory bytes; fetching and caching remain inside this plugin.
- Keep browser resources out of the shared plugin context. Use public memory resolution and generic schema,
  loading-indicator, and environment-constant contribution mechanisms.
- Keep one asset record per configured ID with its downloaded source, memory destinations, and download-indicator handle.
  Fetch distinct URLs concurrently, share one fetch per URL, and publish constants/copy completed sources independently.
  Track each destination with `copiedToMemory`; recopy retained bytes after memory-plan changes.
- Keep binary asset types and state private. Core must not reference binary assets or asset-generated constants.
- Ignore stale fetch results after configuration changes or disposal. Unsubscribe and remove owned contributions
  on disposal, cancelling pending download indicators. Contribute ID `asset:<id>` with message `Loading <id>...`.
  Mark done when downloaded bytes arrive and failed on fetch errors. Memory copies and recompilation never create
  or prolong download indicators. New downloads replace the same asset ID; presentation owns private visibility.
- Verify with `npx nx run @8f4e/editor-plugin-binary-assets:build|test|typecheck` and
  `npx nx run @8f4e/editor-plugin-binary-assets:test:screenshot` for loading contributions and real editor integration.
  Indicator appearance belongs to `editor-plugin-loading-indicators`; do not install its drawer in binary asset tests.
