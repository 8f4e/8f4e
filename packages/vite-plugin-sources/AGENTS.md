# Source Collection Plugin

- This package provides reusable Vite tooling. Keep stdlib, compiler, editor, and gallery knowledge in consumers.
- `sourceFiles` exposes `virtual:8f4e-sources/<name>` as a lazy text-loader map. Keep one output contract.
- Source IDs are paths relative to the configured root, with the final extension removed and `/` separators.
- Run `npx nx run @8f4e/vite-plugin-sources:build|test|typecheck` after changing this package.
- Use small synthetic source trees for integration tests. Exercise real Vite builds and development/watch behavior.
- Build-watch tests must observe native watcher registration before mutating files: Rollup's `BUNDLE_END` does not
  wait for Chokidar's initial directory scan. Keep the blocked-scan regression so this ordering stays deterministic.
- Keep package exports, the client declaration, and README usage examples aligned with the public API.
