# Default Editor Package Guidelines

- This package owns the standard editor composition: compiler integration, runtime selection, the example module registry,
  standard-library resolution, and browser persistence.
- Export composition APIs without mounting as an import side effect.
- Compose the standard state plugin set here and expose host overrides through `plugins`; keep feature logic in its
  plugin package and generic plugin installation in editor-core/editor-state.
- Keep generic editor behavior in `@8f4e/editor-core` and website/deployment concerns in `@8f4e/editor-website`.
- Run `npx nx run @8f4e/editor-default:build|test|typecheck` after changing this package.
- The Vite build uses standard TypeScript and asset handling; project-authored GLSL effects are not supported.
- Stdlib and example module discovery use `@8f4e/vite-plugin-sources` in `vite.config.ts`. Resolve each source package
  root through its exported `package.json`; keep the source collection's IDs relative to that root. The resolvers
  import `virtual:8f4e-sources/stdlib` and `virtual:8f4e-sources/example-modules`. Tests register the same plugins.
- Example module metadata comes from file paths without loading source text. Keep existing filename-based slugs,
  titles, and categories; reject duplicate slugs. Modules load as local lazy chunks and ship with each host's build.
- Keep `@8f4e/examples` as a dependency so its generators run before discovery and its sources affect build caching.
