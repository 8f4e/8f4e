# Editor WebMCP Bridge

- This is a page-owned adapter, not an editor plugin. Accept exactly one editor with a public editing handle at construction.
- Keep WebMCP API detection, schemas, tool registration, and AbortSignal cleanup here. Do not add browser agent concepts to editor-core or editor-state.
- Allow one active bridge per document. Keep tools bound to their original editor; use disposal and reconstruction when the host replaces an editor.
- Delegate edits and history to `editor.editing`, and shared view navigation to `editor.navigation`. Never mutate editor state or implement compilation inside tool callbacks.
- Keep the editor API's complete structured snapshot intact. `get_project` exposes only the currently expanded group or root as one 8f4e source string, with deeper groups left as shells. It accepts no group selector. Navigation tools change the editor's visible group and return location only. Block reads and updates resolve type and name only within that same scope; metadata and batch edits must also stay in the current scope. Include only a handle/line-range index alongside source. Filter duplicate data and convert string/line-array formats only in this adapter. Fetch additional block metadata through its dedicated read tool.
- Compiler diagnostics arrive through an optional injected read handle. Preserve its revision and readiness information.
- Unsupported browsers retain ordinary editing. Failed or cancelled registration must remove partial tools and release the document for a replacement bridge.
- Verify `build`, `test`, and `typecheck` through `npx nx run @8f4e/editor-webmcp:<target>`. Gallery lifecycle checks live in `@8f4e/8f4e-website:test:browser`.
