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

A webpage can mount several independent editors. Those editors do not know about one another, while the host webpage already holds their instance references. Registering WebMCP separately inside each editor plugin would duplicate tool registrations and put page-level coordination inside editor instances.

## Proposed Solution

Expose a transport-independent editing handle on each editor instance. Add a separate, page-owned WebMCP adapter that receives editor references from the host and delegates tool calls to those handles.

Responsibilities:

- **Editor**: Own project reads, validated editing commands, revisions, undo/redo, and the existing consequences of editing.
- **WebMCP adapter**: Register one tool set, resolve explicit editor IDs, validate tool arguments, and call public editor handles.
- **Host webpage**: Construct the adapter, register editor instances with meaningful IDs and optional labels, and manage their lifetimes.

The adapter is an external JavaScript library running in the webpage, proposed as `@8f4e/editor-webmcp`. It is not an editor plugin or a separate MCP server process. Editor-core has no WebMCP dependency and editors remain unaware of one another.

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
const bridge = createEditorWebMcp({ document });

const unregisterSynth = bridge.addEditor({
	id: 'synth',
	label: 'Synthesizer',
	editor: synthEditor,
});

const unregisterSequencer = bridge.addEditor({
	id: 'sequencer',
	label: 'Sequencer',
	editor: sequencerEditor,
});
```

Register one document-level tool set:

| Tool | Purpose |
| --- | --- |
| `list_editors` | List registered editor IDs, labels, and project summaries. |
| `get_project` | Return the selected editor's project snapshot and revision. |
| `apply_edits` | Apply a validated batch to an explicit editor ID and expected revision. |
| `undo` / `redo` | Operate on the selected editor's history, with expected-revision checks. |
| `get_diagnostics` | Return current compiler diagnostics and the revision they describe, when a diagnostic handle is supplied. |

Every editor-specific tool requires `editorId`. Focus can provide context but must not silently retarget a call. IDs remain stable for a registration; duplicate IDs are rejected. Calls must not switch to a replacement registration if an editor is removed while work is pending.

The host unregisters an editor before disposing it. Removing an instance does not remove other instances or the shared tools; disposing the bridge removes its tool registrations and listeners without disposing host-owned editors. Calls to missing or removed editors return explicit errors.

Compiler diagnostics remain owned by the compiler plugin. Supply a separate read handle through host composition if needed; do not move compiler ownership into core or expose compiler internals through mutable state. Associate asynchronous results with the project revision they describe.

## Implementation Plan

### Step 1: Expose editor editing handles

- Define typed snapshots, block handles, edit batches, results, and expected-revision failures in the public editor API.
- Reuse editor-state editing behavior behind those commands, including history grouping, project-change notifications, and derived-state refreshes.
- Specify edit-mode restrictions and behavior after disposal.
- Keep whole-project loading distinct from editing. Use the current project serialization model rather than introducing another source representation.

### Step 2: Build the external adapter

- Add `@8f4e/editor-webmcp` as a separate package with explicit document and editor-reference inputs.
- Implement editor registration, removal, ID lookup, and cleanup. Keep the registry out of editor-core and the editor plugin context.
- Register imperative tools through `document.modelContext.registerTool` in the top-level page, with narrow schemas and accurate read-only annotations.
- Feature-detect WebMCP. Installing the optional adapter in an unsupported browser must leave normal editing operational.
- Add structured results that report target editor, revision, created handles, and validation failures.

### Step 3: Compose and verify browser workflows

- Wire the adapter at a webpage host that owns editor references. Keep automatic mounting and registration out of the default editor's import path.
- Exercise both a single editor and a page with two independent editors, including dynamic removal and re-registration.
- Supply compiler diagnostic read handles from the default composition where required, preserving compiler-plugin ownership.
- Document host setup, supported browser-agent configurations, cleanup responsibilities, and draft API limitations.

## Validation Checkpoints

- Run editor-core and editor-default tests and typechecks through their Nx targets after public API and composition changes.
- Add and run build, test, and typecheck targets for the adapter package through Nx.
- Verify batch rollback on validation failure, one-step undo/redo, stale-revision rejection after both human and API edits, derived layout, autosave notifications, and compilation scheduling.
- Verify two editors share one tool set while keeping project state, revisions, history, diagnostics, and cleanup independent.
- Verify missing editors, disposed handles, duplicate IDs, adapter disposal, and unsupported WebMCP behavior.
- Manually inspect and edit a live project through WebMCP in a supported built-in browser. Verify top-level registration for hosts that embed editor canvases.

## Success Criteria

- [ ] Returned editor instances expose a typed editing handle independent of WebMCP.
- [ ] Project snapshots and block handles support semantic reads and edits without exposing raw mutable state as a write API.
- [ ] Validated batches preserve editor behavior, create one undo step, and reject stale writes without partial changes.
- [ ] A separate adapter accepts host-provided editor references and registers one tool set for the page.
- [ ] Multiple editors require no awareness of one another and are targeted explicitly by ID.
- [ ] Agent-driven edits and diagnostics can be verified against the correct editor and revision.
- [ ] Registration and disposal preserve the lifetimes of unrelated editors and host-owned resources.
- [ ] Browsers without WebMCP retain normal editor behavior, and setup and limitations are documented.

## Affected Components

- `packages/editor/packages/editor-core/src/index.ts` - Public editing handle on the returned editor instance.
- `packages/editor/packages/editor-core/packages/editor-state/` - Existing edit operations, project serialization, change notifications, revisions, and history.
- `packages/editor/packages/editor-webmcp/` - Proposed external WebMCP adapter package.
- `packages/editor/plugins/compiler/` and `packages/editor/packages/editor-default/` - Optional live diagnostic handles and host composition.
- `packages/editor/packages/editor-website/` and `packages/8f4e-website/` - Page-level registration and single/multiple-editor verification.

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
- Reopened on 2026-10-28 with a replacement plan: expose editor editing handles, then add a page-owned external WebMCP adapter that receives editor references. This replaces the original editor-integrated MCP server spike and consolidates TODO 503.

## Archive Instructions

When this TODO is completed:
1. Set `status: Completed` and provide the completion date.
2. Move the file to `docs/todos/archived/`.
3. Move its entry from Active TODOs to Completed TODOs in `docs/todos/_index.md` and update related links.
