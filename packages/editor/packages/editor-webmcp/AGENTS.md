# Editor WebMCP Bridge

- This is a page-owned adapter, not an editor plugin. Accept exactly one editor with a public editing handle at construction.
- Keep WebMCP API detection, schemas, tool registration, and AbortSignal cleanup here. Do not add browser agent concepts to editor-core or editor-state.
- Allow one active bridge per document. Keep tools bound to their original editor; use disposal and reconstruction when the host replaces an editor.
- Delegate edits and history to `editor.editing`. Never mutate editor state or implement compilation inside tool callbacks.
- Compiler diagnostics arrive through an optional injected read handle. Preserve its revision and readiness information.
- Unsupported browsers retain ordinary editing. Failed or cancelled registration must remove partial tools and release the document for a replacement bridge.
- Verify `build`, `test`, and `typecheck` through `npx nx run @8f4e/editor-webmcp:<target>`. Gallery lifecycle checks live in `@8f4e/8f4e-website:test:browser`.
