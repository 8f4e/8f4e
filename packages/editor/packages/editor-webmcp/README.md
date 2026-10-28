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
| `get_project` | `{}` | A plain 8f4e source string for the currently expanded group or root; refreshes the bridge revision baseline. Child groups show declarations without their contents. |
| `get_project_metadata` | `{}` | Current revision, location, editability, and undo/redo availability. |
| `expand_group` | `{ name }` | Navigates the editor into a child group of the current level. Returns location and revision only. |
| `go_to_parent` / `go_to_root` | `{}` | Navigates the editor to the parent or root. Returns location and revision only. |
| `get_block` | `{ type, name }` | A plain source string for the matching block in the current group or root; refreshes the bridge revision baseline. |
| `update_block` | `{ type, name, code }` | Replaces that block's source in the current scope and returns a confirmation string. |
| `patch_block` | `{ type, name, oldText, newText }` | Replaces exactly one matching source span in the current scope and returns a confirmation string. |
| `get_block_metadata` | `{ type, name }` | Current revision and the block's group path, execution entry, type, name, and grid position. |
| `apply_edits` | `{ edits }` | Confirmation string after one atomic undoable batch. |
| `undo` / `redo` | `{}` | Confirmation string after one history step. |
| `get_diagnostics` | `{}` | Project revision, compiler input revision, and diagnostics from the optional host-provided read handle. |

`get_diagnostics` is registered only when the host supplies `getDiagnostics`. The compiler plugin owns that handle. Its `status` is `pending`, `compiling`, `ready`, or `disposed`; `completedRevision` identifies the compiler input that produced a final result. Pending compilations do not expose errors from a previous input as current errors.

`get_project` returns the source string directly, with no envelope, block index, identifiers, or line ranges. It always reads the editor's current location and takes no group selector. To inspect a child group, navigate with `expand_group({ name })`, then call `get_project` again. Use `go_to_parent` or `go_to_root` to leave a group. Navigation changes the same editor view the user sees and returns no source. Human navigation also changes the scope used by subsequent tools.

Each project read contains exactly one level. At the root it includes the `8f4e/v1` header and entry wrappers; inside a group it includes that group's wrapper and immediate blocks. Child group declarations retain their directives and exposure lines, with descendants hidden. These inspection views support unfinished source without export validation.

All block-targeting tools use the same `{ type, name }` selector, such as `{ type: 'note', name: 'colors' }` for `note colors` or `{ type: 'module', name: 'oscillator' }` for `module oscillator`. Names come from source declarations. For an unnamed block use an empty name. Selectors resolve only within the currently expanded group or root. Multiple matches return `ambiguous_block` without applying edits; name blocks uniquely in source before targeting one. Tools do not accept or return editor block identifiers.

The bridge manages source revisions for its lifetime; no tool accepts `expectedRevision`. Before the first write, fetch source with `get_project` or `get_block`. A successful source fetch records its exact revision internally. Each successful edit, undo, or redo advances the baseline to the revision returned by the editor, so consecutive writes need no intervening read. Revisions are opaque tokens; an edit can advance the underlying counter more than once.

If the editor's current revision differs from that baseline, a write returns `stale_revision` with a message explaining that the project changed since the last source fetch or successful edit. Nothing is applied. Fetch source again to acknowledge the changes before retrying. Writes before any source fetch return `source_required`. Metadata, diagnostics, navigation, failed or cancelled reads, and failed writes do not refresh the baseline. Metadata may expose revision information for inspection, but agents do not need to track or echo it. Replacing a bridge starts a fresh baseline and requires a new source fetch.

The revision belongs to the entire editor instance. Persisted source/layout changes, undo/redo, and project loading advance it. Navigation itself does not. The public editor API retains its own expected-revision checks; the bridge supplies the observed token automatically and records the result only after a command succeeds.

Use `patch_block` to change part of a block without resending the complete source:

```ts
patch_block({
  type: 'module',
  name: 'lowPassFilter',
  oldText: 'float alpha 0.04',
  newText: 'float alpha 0.1',
});
```

`oldText` must be nonempty and occur exactly once in the selected block. A missing match returns `match_not_found`; multiple matches, including overlapping occurrences, return `ambiguous_match`. Include surrounding source to make the match unique. Matching and replacement are literal, with CRLF/CR line endings normalized to LF. Text may span multiple lines, and an empty `newText` removes the matched span. The patch uses the existing validated update command, preserves all source outside the match, and creates one undo step. Invalid matches or external source changes leave content and history unchanged. Group source restrictions still apply.

Supported batch edit shapes use `operation` for the action and `type` for the source block type:

```ts
{ operation: 'insert', code: 'module oscillator\n; @pos 10 20\nint value 0\nmoduleEnd', entry: 'main' }
{ operation: 'update', type: 'module', name: 'oscillator', code: 'module oscillator\n; @pos 30 20\nint value 1\nmoduleEnd' }
{ operation: 'delete', type: 'note', name: 'colors' }
```

Batch selectors resolve against the source before the batch is applied. The complete batch is validated before changing the editor, and all operations form one undo step. Writes return simple confirmation strings; inserted names are already present in the submitted source.

Each `code` value is a source string. The bridge joins source lines for reads and splits incoming source on line endings for edits, preserving blank lines, indentation, and trailing newlines. Position comes from `; @pos x y` in the source. Inserts and updates preserve the supplied source, and ordinary blocks use `(0, 0)` when the directive is missing or invalid, matching project loading. Move a block by updating its `@pos` line; there are no separate coordinate inputs or move operations. Inserts always use the current group or root, and default to entry `main` for modules. Batch module updates may also supply `entry`.

Group blocks can be moved, deleted, or have their source updated while retaining the group name; creating or renaming project groups is not part of this command surface. Whole-project loading stays separate and continues through the existing editor UI and host startup paths.

## Public editor API

The same editing operations are available without WebMCP through `editor.editing.getSnapshot()`, `applyEdits({ expectedRevision, edits })`, `undo({ expectedRevision })`, and `redo({ expectedRevision })`. `editor.navigation.openGroup(blockId)`, `goToParentGroup()`, and `goToRoot()` control the shared editor view. Snapshots expose its current `projectPath` (empty at the root). The general editing API can address any project scope; the WebMCP bridge restricts its tools to the currently displayed scope.

The editor API retains its complete structured snapshot, including the canonical project and source as line arrays. Its `blocks` entries are `{ blockId, block }`, where `block` is a detached copy of the existing `CodeBlockGraphicData` model, including its rendering data and derived values. Maps and connections between blocks are preserved by the snapshot; it is not a separate JSON-oriented block model. Source remains authoritative for code-derived properties. Agent-specific filtering, one-level traversal, and string conversion belong only to this bridge. `get_project` and `get_block` return source strings and keep revision bookkeeping inside the bridge. The bridge resolves source-level selectors to internal editor handles, strips editor identifiers from results, and keeps metadata in dedicated tools.

Writes respect edit mode and follow existing project restoration, derived layout, autosave, and compilation mechanisms. They preserve the viewed project group and viewport for edit batches and do not dispatch `loadProject`, so in-project edits keep browser file associations. Invalid batches leave project content and undo history unchanged. Source edits may produce ordinary compiler diagnostics.

The public API throws `EditorEditingError` with `code`, `message`, and, when available, the current `revision`. Tools return structured errors with a code and message. Bridge errors include `source_required`, `stale_revision`, `match_not_found`, and `ambiguous_match`; editor error codes include `read_only`, `stale_revision`, `invalid_edit`, `block_not_found`, and `disposed`. Cancelled tool calls return `cancelled` before applying changes.

## Development

- `npx nx run @8f4e/editor-webmcp:build`
- `npx nx run @8f4e/editor-webmcp:test`
- `npx nx run @8f4e/editor-webmcp:typecheck`
- `npx nx run @8f4e/8f4e-website:test:browser` verifies real editor edits, persistence, and bridge replacement in Chromium.

The browser tests supply an imperative WebMCP registry so these integration checks also run on Chromium versions that do not expose the experimental API. Native site-tool discovery additionally depends on browser/agent availability and permissions.

References: [WebMCP draft](https://webmachinelearning.github.io/webmcp/), [Chrome imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api), [OpenAI site tools](https://learn.chatgpt.com/docs/webmcp).
