# 8f4e WebMCP bridge

`@8f4e/editor-webmcp` exposes one live editor to browser agents through WebMCP. It is an external library composed by the webpage host. It does not install an editor plugin or run a server.

```ts
import { mountDefaultEditor } from '@8f4e/editor-default';
import { createEditorWebMcp } from '@8f4e/editor-webmcp';

const editor = await mountDefaultEditor(canvas, { initialEditorMode: 'edit' });
const bridge = createEditorWebMcp({
	document: canvas.ownerDocument,
	editor,
	getDiagnostics: editor.getDiagnostics,
});
await bridge.ready;

// Before replacing the editor or unmounting the page:
bridge.dispose();
editor.dispose();
```

The editor website installs the bridge for its editor. The example and compiler test galleries install it after the selected project loads, dispose it before switching projects, and create a new bridge for the replacement editor. The homepage's independent preview editors are not bridged.

## Browser support and lifecycle

The bridge checks for `document.modelContext.registerTool`. When it is unavailable, `supported` is false, `ready` resolves, and the editor continues normally. Registration failures reject `ready` and remove partial registrations; hosts should handle the rejection without treating it as a project-loading failure.

Use the top-level webpage document for OpenAI site tools; its built-in browser does not discover tools in iframes. Other browser agents may support a broader WebMCP surface. No tool registration is performed as an import side effect. Registration uses the current imperative API and an `AbortSignal` for cleanup.

One active bridge is allowed per document. It keeps the supplied editor reference for its entire lifetime. Tools have no editor ID, registry, or focus-based routing. Dispose the old bridge before exposing another editor. Saved callbacks from a disposed bridge return a `disposed` error and cannot edit a replacement editor.

## Tools

| Tool | Arguments | Result |
| --- | --- | --- |
| `get_project` | `{}` | The root level as one 8f4e `code` string, with revision, editability, history availability, and a block-handle line-range index. Child groups contain only their own declarations, not their children. |
| `expand_group` | `{ blockId }` | The selected group's own source and immediate blocks as one 8f4e `code` string. Deeper groups remain unexpanded. Includes its project path, revision, and immediate block ranges. |
| `get_block_metadata` | `{ blockId }` | Current revision and the block's group path, execution entry, type, name, and grid position. |
| `apply_edits` | `{ expectedRevision, edits }` | New revision and handles of inserted blocks. The complete batch is validated before application and creates one undo step. |
| `undo` / `redo` | `{ expectedRevision }` | New revision after one history step. |
| `get_diagnostics` | `{}` | Project revision, compiler input revision, and diagnostics from the optional host-provided read handle. |

`get_diagnostics` is registered only when the host supplies `getDiagnostics`. The compiler plugin owns that handle. Its `status` is `pending`, `compiling`, `ready`, or `disposed`; `completedRevision` identifies the compiler input that produced a final result. Pending compilations do not expose errors from a previous input as current errors.

Read `get_project` before writing. To inspect a child group, pass its handle to `expand_group`; repeat for a deeper group of your choice. Both tools return one source level at a time, not a recursive project dump. `get_project` includes the `8f4e/v1` header and root entry wrappers; `expand_group` includes the selected group's wrapper and immediate contents. Group declarations retain their own directives and exposure lines while their descendants remain hidden until explicitly requested. These are inspection views rather than recursive file exports, and unfinished source can be read without export-gate validation. Neither tool changes the editor's viewport or selected group.

The `blocks` array contains only `{ blockId, startLine, endLine }` entries for blocks directly shown in that code string. Ranges are one-based and inclusive, letting agents associate source with editing handles without receiving a second copy of its code. The revision belongs to the entire editor instance; a snapshot from a previous gallery selection is rejected even if the replacement has identical source. Revisions also change after persisted source/layout changes, undo/redo, or project loading. On `stale_revision`, refresh the relevant source view and reconsider the edits before retrying.

Supported edit shapes:

```ts
{ type: 'insert', code: 'module counter\nint value 0\nmoduleEnd', x: 10, y: 20, entry: 'main' }
{ type: 'update', blockId, code: 'module counter\nint value 1\nmoduleEnd' }
{ type: 'move', blockId, x: 30, y: 20 }
{ type: 'delete', blockId }
```

Each `code` value is a source string. The bridge joins source lines for reads and splits incoming source on line endings for edits, preserving blank lines, indentation, and trailing newlines. Positions use integer grid coordinates. Inserts default to `(0, 0)`, the root project, and entry `main` for modules. Fetch block metadata when group scope or execution context is needed; supply its `projectPath` to insert inside that project group. An update preserves a block's position unless its source specifies `; @pos`. Module updates may also supply `entry`.

Block handles distinguish duplicate block IDs in nested project scopes. Treat them as opaque and refresh them after editing. Group blocks can be moved, deleted, or have their source updated while retaining the group name; creating or renaming project groups is not part of this command surface. Whole-project loading stays separate and continues through the existing editor UI and host startup paths.

## Public editor API

The same operations are available without WebMCP through `editor.editing.getSnapshot()`, `applyEdits({ expectedRevision, edits })`, `undo({ expectedRevision })`, and `redo({ expectedRevision })`.

The editor API retains its complete structured snapshot, including the canonical project and source as line arrays. Its `blocks` entries are `{ blockId, block }`, where `block` is a detached copy of the existing `CodeBlockGraphicData` model, including its rendering data and derived values. Maps and connections between blocks are preserved by the snapshot; it is not a separate JSON-oriented block model. Source remains authoritative for code-derived properties. Agent-specific filtering, one-level traversal, and string conversion belong only to this bridge. Source views omit the duplicate canonical project and keep block metadata in the separate lookup tool.

Writes respect edit mode and follow existing project restoration, derived layout, autosave, and compilation mechanisms. They preserve the viewed project group and viewport for edit batches and do not dispatch `loadProject`, so in-project edits keep browser file associations. Invalid batches leave project content and undo history unchanged. Source edits may produce ordinary compiler diagnostics.

The public API throws `EditorEditingError` with `code`, `message`, and, when available, the current `revision`. Tools return those errors as structured JSON. Error codes include `read_only`, `stale_revision`, `invalid_edit`, `block_not_found`, and `disposed`. Cancelled tool calls return `cancelled` before applying changes.

## Development

- `npx nx run @8f4e/editor-webmcp:build`
- `npx nx run @8f4e/editor-webmcp:test`
- `npx nx run @8f4e/editor-webmcp:typecheck`
- `npx nx run @8f4e/8f4e-website:test:browser` verifies real editor edits, persistence, and bridge replacement in Chromium.

The browser tests supply an imperative WebMCP registry so these integration checks also run on Chromium versions that do not expose the experimental API. Native site-tool discovery additionally depends on browser/agent availability and permissions.

References: [WebMCP draft](https://webmachinelearning.github.io/webmcp/), [Chrome imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api), [OpenAI site tools](https://learn.chatgpt.com/docs/webmcp).
