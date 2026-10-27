---
title: 'TODO: Trigger autosave and history only on project changes'
priority: High
effort: 3-6h
created: 2026-10-10
issue: https://github.com/8f4e/8f4e/issues/1024
status: Open
completed: null
---

# TODO: Trigger Autosave and History Only on Project Changes

## Problem Description

Selecting a code block can trigger session autosaving and add an undo-history entry even when project source is
unchanged. The history update also clears the redo stack, so clicking a block after an undo can discard redo history.

Both effects subscribe to `codeBlockRendering.selectedCodeBlock.code`. The state manager notifies child subscriptions
when a parent path is assigned, including when the same selected block is assigned again. Mouse clicks and block
navigation therefore reach these effects without an edit.

Reassigning an already-selected block with unchanged source produces one session save immediately, then one history
entry and an empty redo stack after the history effect's one-second debounce.

## Proposed Solution

Introduce a general project-change signal, such as `projectRevision`, for changes to persisted project content.
Use it to drive session autosaving and to identify edits eligible for undo-history tracking.

This signal must include code edits, block creation/deletion/paste, programmatic edits, and persisted editor metadata
such as block positions, favorites, and visual grouping. Selection, caret movement, and navigation should leave it
unchanged. Multi-block operations should announce one completed change; no-op actions should announce none.

Keep `compilerInputRevision` focused on compiler inputs. It intentionally excludes visual metadata and cannot cover
all changes that need saving or undo support.

Distinguish ordinary edits from project loading and undo/redo restoration. Restoring a project should update session
persistence without adding a normal edit-history entry or clearing the remaining redo stack. Only a new edit should
invalidate redo history.

## Success Criteria

- [ ] Clicking a block, selecting a line, and navigating between blocks or nested projects do not autosave or add
  history entries.
- [ ] Selection and navigation after undo preserve redo history, including after the debounce period expires.
- [ ] Source edits and persisted metadata changes trigger autosaving and appropriate history tracking.
- [ ] Programmatic edits and operations affecting multiple blocks produce no duplicate history entries.
- [ ] No-op actions produce no saves or history entries.
- [ ] Project loading and undo/redo restoration preserve history semantics and update session persistence correctly.
- [ ] Metadata changes continue to leave `compilerInputRevision` unchanged.

## Affected Components

- `packages/editor/packages/editor-core/packages/editor-state/src/features/edit-history/effect.ts`
- `packages/editor/packages/editor-core/packages/editor-state/src/features/session-persistence/effect.ts`
- `packages/editor/packages/editor-core/packages/editor-state/src/features/code-editing/effect.ts`
- `packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/` source and metadata updates
- `packages/editor/packages/editor-core/packages/editor-state-types/src/index.ts` and state defaults/test helpers

## Validation Checkpoints

- Add regression tests using the real state manager and fake timers for selection after undo, repeated selection,
  navigation, metadata edits, batched operations, and project restoration.
- Run `npx nx run @8f4e/editor-state:test` and affected typechecks.
- In the browser, edit, undo, click or navigate, wait longer than one second, and confirm redo still restores the edit.
