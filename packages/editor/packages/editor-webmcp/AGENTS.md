# Editor WebMCP Guidelines

- Bind one active bridge per document to one editor. Keep browser API detection, tool schemas, registration and
  cleanup in the adapter. Dispose and recreate on editor replacement, including cleanup after partial registration.
- Read current state through the public editor. Delegate writes and history to `editor.editing` and navigation to
  `editor.navigation`. Keep tool-specific projections outside core.
- Scope project and block operations to the current project level. Resolve source type/name selectors to editor
  handles internally and express placement through source `@pos` directives.
- Record the source revision baseline in the bridge after successful source reads and writes. Require a fresh
  source read if the baseline is missing or stale, and pass the matching revision to the editing API. Reference,
  metadata, diagnostics and navigation operations leave the source baseline alone.
- Bundle reference material through Vite source collections. Keep the index eager and full content lazy. Reuse
  public example catalog helpers and keep shipped docs and examples in the generator's Nx inputs.
- Keep real-editor tool tests in `@8f4e/editor-webmcp:test:browser`. Host tests own bridge loading and replacement.
