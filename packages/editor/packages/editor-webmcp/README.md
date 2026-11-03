# 8f4e WebMCP bridge

`@8f4e/editor-webmcp` exposes one live editor to browser agents through WebMCP. It is an external library composed by the webpage host. It does not install an editor plugin or run a server.

```ts
import { mountDefaultEditor } from '@8f4e/editor-default';
import { createEditorWebMcp } from '@8f4e/editor-webmcp';

const editor = await mountDefaultEditor(canvas);
const bridge = createEditorWebMcp({
	document: canvas.ownerDocument,
	editor,
	getCompilerDiagnostics: editor.getCompilerDiagnostics,
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
| `get_help` | `{}` | Markdown introduction to 8f4e, a complete small program, and documentation, example, and editing workflows. |
| `search_docs` | `{ query, offset? }` | Documentation topics and summaries, with `total` and `nextOffset`. An empty query browses the catalog. |
| `get_docs` | `{ topic }` | Markdown for a topic returned by `search_docs`, including enclosing introductions and placement rules. |
| `search_examples` | `{ query, kind?, offset? }` | Example metadata and dependency paths, with `total` and `nextOffset`. `kind` is `block` or `project`; an empty query browses the catalog. |
| `get_example` | `{ kind, path }` | A reusable public block or a complete project as a plain source string. |
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
| `get_compiler_diagnostics` | `{}` | Project revision, compiler input revision, and diagnostics from the optional host-provided read handle. |

The five reference tools are always included when the bridge registers its tools. `get_help` is the starting point for agents unfamiliar with 8f4e. Search results contain up to 20 matches; repeat the same query and optional kind with `offset: nextOffset` to continue. Use the returned topic or example kind/path for exact reads:

```ts
search_docs({ query: 'push' });
get_docs({ topic: 'compiler/instructions/stack#push' });
search_examples({ query: 'low pass filter', kind: 'block' });
get_example({ kind: 'block', path: 'filters/lowPassFilter' });
get_example({ kind: 'project', path: 'audio/reverb' });
```

Documentation topics cover the existing compiler and editor references, including source syntax, instructions, compiler directives, editor directives, configuration, and runtime concepts. Full-page topics use paths such as `compiler/source-syntax` and `editor/editor-directives`; named sections add a heading anchor. Search summaries use the selected section's first explanatory paragraph, and search terms come from that section rather than inherited introductions. Titles, summaries, and query matching preserve language symbols such as `#`, `@`, `*`, `&`, `[]`, and identifier underscores. Full topic reads still preserve relevant enclosing introductions, such as compiler-directive prologue rules.

Example searches return `kind`, `path`, `title`, `category`, `summary`, and `dependencies`. Names and categories reuse the editor's module catalog logic. Block summaries use the first prose-comment paragraph when available; project summaries use explanatory note blocks parsed through the compiler's project parser. All descriptive prose participates in search, including words beyond the short summary. For example, searching `distortion`, `lo-fi`, or `quantization` finds bitcrusher through its source description. Block reads reuse the public-block extraction, exclude test-entry modules, and remove the library-only `@public` marker. `dependencies` lists direct references to other catalog blocks as paths that can be fetched with `get_example`; follow those blocks' dependencies as needed. Runtime-provided namespaces such as `env` are not example blocks. Project reads preserve the entire original file, including nested groups.

Help, documentation, and examples are bundled with `@8f4e/editor-webmcp`. Hosts supply no reference catalog or URLs. The build imports Markdown, `.8f4em`, and `.8f4e` collections through `@8f4e/vite-plugin-sources`, generates the search catalog, and ships full content as lazy modules inside the package. Searches use the bundled index; exact document and example reads load only their requested content. These tools do not change editor state or navigation, insert or open examples, or refresh the live-source revision baseline.

`get_compiler_diagnostics` is registered only when the host supplies `getCompilerDiagnostics`. The compiler plugin owns that handle. Its `status` is `pending`, `compiling`, `ready`, or `disposed`; `completedRevision` identifies the compiler input that produced a final result. Pending compilations do not expose errors from a previous input as current errors.

`get_project` returns the source string directly, with no envelope, block index, identifiers, or line ranges. It always reads the editor's current location and takes no group selector. To inspect a child group, navigate with `expand_group({ name })`, then call `get_project` again. Use `go_to_parent` or `go_to_root` to leave a group. Navigation changes the same editor view the user sees and returns no source. Human navigation also changes the scope used by subsequent tools.

Each project read contains exactly one level. At the root it includes the `8f4e/v1` header and entry wrappers; inside a group it includes that group's wrapper, local entry sections, and immediate blocks. Child group declarations retain their directives, exposure lines, and empty entry sections, with descendants hidden. These inspection views support unfinished source without export validation.

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

Consumers read the existing internals directly through `editor.state`. `editor.editing.getRevision()` returns the current opaque project revision without constructing or cloning a project snapshot. The editor exposes validated `applyEdits({ expectedRevision, edits })`, `undo({ expectedRevision })`, and `redo({ expectedRevision })` commands. Use `getEditorBlockId(block)` from `@8f4e/editor-core` for command targets read from state. `editor.navigation.openGroup(blockId)`, `goToParentGroup()`, and `goToRoot()` control the shared editor view. The general editing API can address any project scope; the bridge resolves type/name selectors within the current live block slice.

`applyEdits` returns `{ revision, createdBlockIds }`. `undo` and `redo` return `{ revision }`.

The bridge collects and formats state synchronously. It selects only the source or metadata required by each tool and converts source line arrays to strings. Code remains authoritative for derived properties. Consumers retaining data across asynchronous work can copy the specific data they need; there is no separate `EditorProjectSnapshot` model or automatic full-graph clone.

Writes respect edit mode and follow existing project restoration, derived layout, autosave, and compilation mechanisms. They preserve the viewed project group and viewport for edit batches and do not dispatch `loadProject`, so in-project edits keep browser file associations. Invalid batches leave project content and undo history unchanged. Source edits may produce ordinary compiler diagnostics.

The public API throws `EditorEditingError` with `code`, `message`, and, when available, the current `revision`. Tools return structured errors with a code and message. Bridge errors include `source_required`, `stale_revision`, `match_not_found`, `ambiguous_match`, `documentation_not_found`, and `example_not_found`; editor error codes include `read_only`, `stale_revision`, `invalid_edit`, `block_not_found`, and `disposed`. Cancelled tool calls return `cancelled` before applying changes. Lazy reference reads also reject cancellation or bridge disposal while their content is loading.

## Development

`src/index.ts` owns browser support detection, registration, and disposal. Named tool definitions keep their schemas and handlers together in `src/editor-tools.ts` and `src/reference-tools.ts`; `src/tool.ts` handles argument envelopes, cancellation, and errors. The editor tool family owns current-group targeting and the revision baseline. Reference tools have no editor binding.

The content generator uses pure analysis in `scripts/catalog.ts` and shared Markdown scanning in `scripts/markdown.ts`. `scripts/generate-content.ts` loads the source collections and writes the catalog and lazy content modules. Catalog fixture tests run with the unit suite alongside the bundled-content and public-tool checks.

- `npx nx run @8f4e/editor-webmcp:build`
- `npx nx run @8f4e/editor-webmcp:test`
- `npx nx run @8f4e/editor-webmcp:typecheck`
- `npx nx run @8f4e/editor-webmcp:generate-content` rebuilds the bundled reference catalog and lazy source modules. Build, test, and typecheck run it automatically. Generated files under `src/generated/` and the temporary `.content-generator/` build are ignored by Git. Compiler/editor Markdown and example-package sources participate in Nx cache inputs.
- `npx nx run @8f4e/editor-webmcp:test:browser` verifies source reads, editing commands, revisions, persistence, and history against a real editor in Chromium.
- `npx nx run @8f4e/8f4e-website:test:browser` verifies homepage/gallery hosting and bridge replacement.

The browser tests supply an imperative WebMCP registry so these integration checks also run on Chromium versions that do not expose the experimental API. Native site-tool discovery additionally depends on browser/agent availability and permissions.

References: [WebMCP draft](https://webmachinelearning.github.io/webmcp/), [Chrome imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api), [OpenAI site tools](https://learn.chatgpt.com/docs/webmcp).
