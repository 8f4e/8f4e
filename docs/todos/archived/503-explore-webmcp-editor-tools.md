---
title: 'TODO: Explore WebMCP tools for inspecting and editing projects'
priority: Medium
effort: 1-2d
created: 2026-10-18
issue: null
status: Cancelled
completed: 2026-10-28
---

# TODO: Explore WebMCP tools for inspecting and editing projects

## Resolution

Superseded and archived on 2026-10-28 by [TODO 210: Expose editor editing handles and add an external WebMCP adapter](../210-add-editor-editing-handles-and-webmcp-adapter.md). The reopened TODO defines public editor editing handles and a separate page-owned adapter that receives editor references and shares one tool set across multiple independent editors. The research proposal below is retained as history; implementation remains open in TODO 210.

## Problem Description

The canvas-based editor does not expose its project structure through ordinary DOM elements. Browser agents can inspect the rendered canvas and, with browser debugging access, examine page state, but they do not have a stable semantic interface for reading or changing code blocks.

The editor currently exposes live state for debugging, while add, edit, and remove behavior remains internal to editor-state effects. Directly mutating that state from a browser agent would bypass invariants such as derived-state refreshes, compiler input revisions, undo/history, persistence, and recompilation.

WebMCP may provide a browser-native way to expose narrow editor operations to Codex and other compatible agents while preserving the shared visible page and signed-in browser session. The proposal and browser implementations are still evolving, so the integration boundaries should be researched before committing the editor API to them.

## Proposed Solution

Research and prototype an agent-facing editor command surface with WebMCP as a progressive adapter:

- Evaluate current WebMCP support in Chrome and Codex browser workflows.
- Compare direct Chrome inspection through browser developer access with WebMCP site tools.
- Define a stable editor-core command API independently of WebMCP.
- Prototype top-level imperative WebMCP tools that delegate to that command API.
- Preserve the normal editor interface and behavior when WebMCP is unavailable.

Candidate operations:

- Read a project summary and current compiler input revision.
- List code blocks and retrieve one block's source and metadata.
- Add, replace, and remove code blocks.
- Apply a validated atomic batch of code-block changes.
- Read compiler and editor diagnostics after a change.

## Anti-Patterns

- Do not expose the complete mutable editor state as an agent write API.
- Do not let WebMCP handlers duplicate code-block editing, history, persistence, or compilation logic.
- Do not require experimental browser APIs for ordinary editor startup.
- Do not rely on iframe tool discovery; current Codex site-tool support only discovers tools registered by the top-level page.
- Do not silently apply changes against stale project state.

## Implementation Plan

### Step 1: Document current browser-agent capabilities

- Verify inspection of a running 8f4e editor through the supported Chrome integration and browser developer mode.
- Record what is available through screenshots, DOM/accessibility state, page globals, console access, and WebMCP discovery.
- Test the main editor website and embedded/gallery variants separately.

### Step 2: Design a browser-independent editor command API

- Add or propose a narrow public command facade in `@8f4e/editor-core` rather than exposing internal events or state-manager operations.
- Define opaque code-block handles that remain unambiguous across nested project groups.
- Include `compilerInputRevision` or an equivalent expected-revision value in write operations to reject stale edits.
- Specify validation, edit-mode behavior, history grouping, autosave, recompilation, and error reporting for each command.

### Step 3: Prototype imperative WebMCP tools

- Register tools only when `document.modelContext.registerTool` is available.
- Keep registrations in the top-level document and dispose them with the editor instance.
- Add read-only annotations to inspection tools and accurately mark mutating or consequential operations.
- Keep schemas narrow and return enough project state and diagnostics to verify each result.

### Step 4: Evaluate the prototype

- Exercise read, add, replace, delete, stale-revision, cancellation, and unsupported-browser flows.
- Verify that agent-driven edits behave like equivalent user edits for derived rendering state, undo/history, autosave, and compilation.
- Compare a small set of representative tasks using browser actuation, browser developer access, and WebMCP tools.
- Decide whether to ship, revise, or defer the integration while the draft evolves.

## Validation Checkpoints

- `npx nx run @8f4e/editor-core:test`
- `npx nx run @8f4e/editor-core:typecheck`
- `npx nx run @8f4e/editor-default:test`
- `npx nx run @8f4e/editor-default:typecheck`
- Manual verification in the built-in browser and a supported Chrome development configuration.

## Success Criteria

- [ ] Current Codex and Chrome support, limitations, and setup requirements are documented.
- [ ] The proposed editor command API does not expose raw mutable state.
- [ ] Code-block handles and stale-edit behavior are specified.
- [ ] A prototype can inspect and safely add, replace, and remove code blocks.
- [ ] Agent-driven changes preserve editor invariants and produce verifiable diagnostics.
- [ ] Unsupported browsers continue to use the editor without errors or behavioral changes.
- [ ] A written recommendation records whether and how the integration should proceed.

## Affected Components

- `packages/editor/packages/editor-core/src/index.ts` - Potential public command facade.
- `packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/` - Existing edit operations and invariants to reuse.
- `packages/editor/packages/editor-default/src/` - Potential WebMCP adapter and registration lifecycle.
- `packages/editor/packages/editor-website/src/main.ts` - Top-level editor host used for manual verification.
- `packages/8f4e-website/src/` - Embedded and multi-editor behavior to evaluate.

## Risks & Considerations

- **Draft churn**: WebMCP is a Community Group draft and its browser surface may change.
  - Mitigation: Keep the command facade browser-independent and isolate WebMCP in an adapter.
- **Unsafe mutation**: Raw state edits could bypass editor invariants or overwrite newer user work.
  - Mitigation: Route writes through validated commands with expected-revision checks and atomic history entries.
- **Tool trust**: Tool descriptions and results are untrusted inputs to browser agents.
  - Mitigation: Use narrow schemas, accurate annotations, normal editor authorization, and verifiable results.
- **Canvas visibility**: Screenshots alone do not provide the semantic project representation.
  - Mitigation: Expose dedicated read tools for source, metadata, and diagnostics.
- **Multiple editors**: Product pages may mount more than one editor instance.
  - Mitigation: Define explicit active-editor selection or instance handles before registering mutating tools.
- **Breaking Changes**: None should be required for the research/prototype phase; any public editor API needs a separate compatibility review.

## References

- [WebMCP Community Group draft](https://webmachinelearning.github.io/webmcp/)
- [Chrome WebMCP developer guide](https://developer.chrome.com/docs/ai/webmcp)
- [OpenAI site tools documentation](https://learn.chatgpt.com/docs/webmcp)
- [OpenAI browser extension documentation](https://learn.chatgpt.com/docs/chrome-extension)
- [OpenAI developer settings](https://learn.chatgpt.com/docs/developer-settings)

## Notes

- The first useful milestone is read-only project inspection; mutating tools should follow only after the command facade is defined.
- Prefer one atomic change-set tool for coordinated edits, with smaller add/replace/remove tools retained only when they materially improve reliability.
- Recheck the WebMCP draft and supported browser versions when implementation begins.

## Archive Instructions

When this TODO is completed:
1. Update the front matter to set `status: Completed` and provide the `completed` date.
2. Move it to the `docs/todos/archived/` folder.
3. Move its entry from Active TODOs to Completed TODOs in `docs/todos/_index.md`.
