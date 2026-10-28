---
title: 'TODO: Expose editor editing handles and add an external WebMCP adapter'
priority: Medium
effort: 2-4d
created: 2026-02-07
issue: null
status: Open
completed: null
---

# TODO: Expose editor editing handles and add an external WebMCP adapter

## Problem Description

Browser agents need a semantic way to inspect and edit the same live 8f4e project that a person sees on the canvas. The returned editor instance exposes state and rendering controls, but editing operations remain internal. Writing directly to that state would bypass derived layout, undo history, persistence notifications, and compilation scheduling.

A webpage can mount several independent editors. The host webpage already holds their instance references and should explicitly choose one editor to expose to browser agents. Binding the tools to that editor avoids ambiguity about which project a tool call will read or change.

## Proposed Solution

Expose a transport-independent editing handle on each editor instance. Add a separate, page-owned WebMCP adapter that receives exactly one editor reference from the host and delegates every tool call to that editor's handles.

Responsibilities:

- **Editor**: Own project reads, validated editing commands, revisions, undo/redo, and the existing consequences of editing.
- **WebMCP adapter**: Register one tool set bound to the supplied editor, validate tool arguments, and call its public handles.
- **Host webpage**: Choose the editor to expose, pass its reference when constructing the adapter, and manage both lifetimes.

The adapter is an external JavaScript library running in the webpage, proposed as `@8f4e/editor-webmcp`. It is not an editor plugin or a separate MCP server process. Editor-core has no WebMCP dependency. A page may contain other editors, but the bridge exposes only the chosen instance.

### Public editing handle

Proposed shape on the returned `Editor` instance:

```ts
editor.editing.getSnapshot(); // { project, revision }
editor.editing.applyEdits({ expectedRevision, edits });
editor.editing.undo();
editor.editing.redo();
```

- Return a detached project snapshot and its matching revision, rather than a live mutable state object.
- Support inserting, updating, moving, and deleting code blocks, using opaque block handles that also identify blocks within nested groups.
- Validate the complete batch before changing state and apply it as one undo step. Validation covers operation shape, targets, and editor policy; source edits may produce normal compiler diagnostics.
- Route successful edits through the existing project-change mechanisms so derived layout, rendering, autosave, and compilation remain consistent with human edits.
- Advance an editor-local project revision for persisted changes from both human and API operations, including undo, redo, and project replacement. Compiler input revisions alone may miss layout-only edits.
- Reject outdated expected revisions without applying partial changes. Return the current revision and actionable error details.
- Return the new revision and created block handles after a successful batch.
- Keep whole-project loading separate from in-project edits, preserving the existing `loadProject` behavior and file-association handling.

### Page-owned WebMCP adapter

Illustrative host composition:

```ts
const bridge = createEditorWebMcp({
	document,
	editor: synthEditor,
});
```

Register one document-level tool set:

| Tool | Purpose |
| --- | --- |
| `get_project` | Return the bound editor's project snapshot and revision. |
| `apply_edits` | Apply a validated batch to the bound editor at an expected revision. |
| `undo` / `redo` | Operate on the bound editor's history, with expected-revision checks. |
| `get_diagnostics` | Return current compiler diagnostics and the revision they describe, when a diagnostic handle is supplied. |

The editor reference is required at construction and stays fixed for the bridge's lifetime. Tools take no `editorId` argument, and there is no editor registry, discovery tool, or add/remove-editor API. Focus changes never retarget calls. Allow only one active bridge per document so the page exposes one unambiguous tool set.

The host disposes the bridge before disposing its editor. Bridge disposal removes its tool registrations and listeners without disposing the host-owned editor. Calls after bridge or editor disposal return explicit errors. To expose a different editor, the host must dispose the old bridge and construct a new one; pending calls remain tied to the original editor and cannot affect its replacement.

Compiler diagnostics remain owned by the compiler plugin. Supply a separate read handle through host composition if needed; do not move compiler ownership into core or expose compiler internals through mutable state. Associate asynchronous results with the project revision they describe.

## Implementation Plan

### Step 1: Expose editor editing handles

- Define typed snapshots, block handles, edit batches, results, and expected-revision failures in the public editor API.
- Reuse editor-state editing behavior behind those commands, including history grouping, project-change notifications, and derived-state refreshes.
- Specify edit-mode restrictions and behavior after disposal.
- Keep whole-project loading distinct from editing. Use the current project serialization model rather than introducing another source representation.

### Step 2: Build the external adapter

- Add `@8f4e/editor-webmcp` as a separate package requiring a document and exactly one editor reference at construction.
- Implement fixed editor binding and cleanup, rejecting a second active bridge for the same document. Keep the adapter outside editor-core and the editor plugin context.
- Register imperative tools through `document.modelContext.registerTool` in the top-level page, with narrow schemas and accurate read-only annotations.
- Feature-detect WebMCP. Installing the optional adapter in an unsupported browser must leave normal editing operational.
- Add structured results that report revision, created handles, and validation failures for the bound editor.

### Step 3: Compose and verify browser workflows

- Wire the adapter at a webpage host that supplies its chosen editor reference. Keep automatic mounting and registration out of the default editor's import path.
- Exercise a single editor and a page with additional unbridged editors, verifying that every tool call stays bound to the chosen editor even when another editor receives focus.
- Supply compiler diagnostic read handles from the default composition where required, preserving compiler-plugin ownership.
- Document host setup, supported browser-agent configurations, cleanup responsibilities, and draft API limitations.

## Validation Checkpoints

- Run editor-core and editor-default tests and typechecks through their Nx targets after public API and composition changes.
- Add and run build, test, and typecheck targets for the adapter package through Nx.
- Verify batch rollback on validation failure, one-step undo/redo, stale-revision rejection after both human and API edits, derived layout, autosave notifications, and compilation scheduling.
- Verify tools read and change only the bound editor's project, revision, history, and diagnostics, leaving additional editors unaffected.
- Verify a required editor reference, rejection of a second active bridge in the same document, disposed handles, bridge replacement, adapter disposal, and unsupported WebMCP behavior.
- Manually inspect and edit a live project through WebMCP in a supported built-in browser. Verify top-level registration for hosts that embed editor canvases.

## Success Criteria

- [ ] Returned editor instances expose a typed editing handle independent of WebMCP.
- [ ] Project snapshots and block handles support semantic reads and edits without exposing raw mutable state as a write API.
- [ ] Validated batches preserve editor behavior, create one undo step, and reject stale writes without partial changes.
- [ ] A separate adapter accepts exactly one host-provided editor reference and registers one tool set for the page.
- [ ] Every tool stays bound to that editor, without an editor registry, ID routing, or focus-based selection.
- [ ] Agent-driven edits and diagnostics can be verified against the bound editor's project revision.
- [ ] Bridge disposal and replacement preserve host-owned resources and cannot redirect pending calls to another editor.
- [ ] Browsers without WebMCP retain normal editor behavior, and setup and limitations are documented.

## Affected Components

- `packages/editor/packages/editor-core/src/index.ts` - Public editing handle on the returned editor instance.
- `packages/editor/packages/editor-core/packages/editor-state/` - Existing edit operations, project serialization, change notifications, revisions, and history.
- `packages/editor/packages/editor-webmcp/` - Proposed external WebMCP adapter package.
- `packages/editor/plugins/compiler/` and `packages/editor/packages/editor-default/` - Optional live diagnostic handles and host composition.
- `packages/editor/packages/editor-website/` and `packages/8f4e-website/` - Page-level composition and verification that only the chosen editor is exposed.

## Risks & Considerations

- **Editor invariants**: Public commands must reuse the existing editing mechanisms rather than duplicate state mutations in the adapter.
- **Concurrent edits**: Revisions must cover persisted source and layout changes from every editing path. A read followed by a write cannot assume the user left the project unchanged.
- **Browser API changes**: Keep WebMCP-specific registration and schemas inside the adapter and recheck support when implementation starts. Current OpenAI site tools require top-level imperative registration.
- **Public API scope**: Start with project/block editing and diagnostics. Runtime memory writes and file-system operations need separately defined handles if added later.

## Related Items

- [TODO 492: Trigger autosave and history only on project changes](492-trigger-autosave-and-history-only-on-project-changes.md) - Coordinate project-change and revision semantics.
- [TODO 503: Explore WebMCP tools for inspecting and editing projects](archived/503-explore-webmcp-editor-tools.md) - Superseded by this implementation plan.

## References

- [WebMCP Community Group draft](https://webmachinelearning.github.io/webmcp/)
- [Chrome WebMCP imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [OpenAI site tools documentation](https://learn.chatgpt.com/docs/webmcp)

## Notes

- Originally created on 2026-02-07; cancelled and archived by request on 2026-05-12.
- Reopened on 2026-10-28 with a replacement plan: expose editor editing handles, then add a page-owned external WebMCP adapter. This replaces the original editor-integrated MCP server spike and consolidates TODO 503.
- Revised on 2026-10-28 to bind the external adapter to exactly one editor instance. The host chooses that editor at construction; multi-editor registration and routing are outside the plan.

## Archive Instructions

When this TODO is completed:
1. Set `status: Completed` and provide the completion date.
2. Move the file to `docs/todos/archived/`.
3. Move its entry from Active TODOs to Completed TODOs in `docs/todos/_index.md` and update related links.
