---
title: 'TODO: Investigate optional editing locks for agent sessions'
priority: Low
effort: TBD
created: 2026-10-28
issue: null
status: Open
completed: null
---

# TODO: Investigate optional editing locks for agent sessions

## Problem Description

The public editor editing API uses atomic edit batches and expected-revision checks. Human input cannot interleave with a synchronous batch, and changes made while an agent reads or thinks cause its next stale write to be rejected.

An agent making a larger change across several tool calls may still be interrupted by human edits. Temporarily reserving editing could help it complete a coherent change, but could also leave the user waiting while the agent reasons, stops responding, or never explicitly finishes.

Investigate whether optional editing sessions would improve this workflow enough to justify their complexity and interruption of human editing.

## Scope

This is follow-up design work. Editing locks are outside the implementation scope of [TODO 210](archived/210-add-editor-editing-handles-and-webmcp-adapter.md) and [PR #1305](https://github.com/8f4e/8f4e/pull/1305). The current WebMCP bridge continues to use revision checks and atomic batches.

## Proposed Investigation

Compare the current optimistic approach with an optional, temporary editing session for changes that span multiple batches. Keep both adopting and deferring locking as valid outcomes.

Questions to resolve:

- When does a lock help beyond applying one larger atomic batch or rereading after a revision conflict?
- Should sessions be explicitly requested by the agent, offered to the user, or enabled only for particular workflows?
- Which actions would pause: source edits, block movement, undo/redo, project loading, or runtime controls? Which inspection and navigation actions should remain available?
- How should the editor show that an agent is editing, and how does a visible **Take over** action revoke its authority before the user resumes editing?
- How would an agent explicitly start, renew, and finish a session? The webpage sees individual tool calls and cannot infer the end of the agent's broader task.
- What timeout or renewable lease would recover from an abandoned session without interrupting legitimate work?
- How should cancellation, timeout, takeover, project switching, and bridge/editor disposal invalidate pending and later agent writes?
- Where should coordination live so the editor's public API stays independent of WebMCP and the external bridge remains bound to one editor?

Any proposed lock should complement expected-revision checks. Expiration or takeover must not make a delayed agent write valid against a newer project state.

## Investigation Plan

### Step 1: Identify workflows and alternatives

- Walk through short edits, longer changes across multiple batches, and simultaneous human editing.
- Compare revision conflicts, a single larger batch, and optional exclusive sessions.
- Record when users would gain or lose control with each approach.

### Step 2: Define candidate interaction and lifecycle rules

- Sketch session status and takeover behavior without committing to a production UI or tool API.
- Specify possible ownership, renewal, expiration, revocation, and project-replacement rules.
- Walk through an agent that stops responding or sends a write after its session ends.

### Step 3: Record a recommendation

- Decide whether to implement optional sessions, refine another approach, or keep the current model.
- If implementation is recommended, define a separate implementation scope, acceptance criteria, and migration needs.

## Success Criteria

- [ ] Concrete workflows establish whether locking provides a practical benefit over the current API.
- [ ] A proposed policy covers affected user actions, visibility, takeover, and abandoned-session recovery.
- [ ] Ownership and revocation rules cover stale writes, project changes, and disposal.
- [ ] A documented recommendation states whether and how to proceed, with revision checks retained.

## Potentially Affected Components

- `packages/editor/packages/editor-core/packages/editor-state/src/editing/` - Transport-independent command policy and revision checks.
- `packages/editor/packages/editor-webmcp/` - Possible explicit session tools and lifecycle integration.
- `packages/editor/packages/editor-core/packages/web-ui/` - Possible session status and takeover interaction.
- `packages/editor/packages/editor-website/` and `packages/8f4e-website/` - Host ownership and project-switch behavior.

## Risks & Considerations

- A lock that lasts while an agent thinks can interrupt the human's work longer than expected.
- An abandoned session needs recovery even when no final tool call arrives.
- Revoking a session must reject delayed writes rather than silently transfer ownership to another project or editor.
- Session state and history grouping are separate decisions; acquiring or releasing a lock should not accidentally create undo entries.

## Related Items

- [TODO 210: Expose editor editing handles and add an external WebMCP adapter](archived/210-add-editor-editing-handles-and-webmcp-adapter.md).
- [TODO 492: Trigger autosave and history only on project changes](492-trigger-autosave-and-history-only-on-project-changes.md).

## Notes

- Created on 2026-10-28 after discussing temporary human-editing restrictions during agent work. The locking policy and implementation remain undecided.

## Archive Instructions

When this investigation is completed:
1. Set `status: Completed` and provide the completion date.
2. Move the file to `docs/todos/archived/` and update related links.
3. Move its entry from Active TODOs to Completed TODOs in `docs/todos/_index.md`, recording the recommendation.
