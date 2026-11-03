---
title: 'TODO: Remove unused editor-core feature-flag configuration'
priority: Medium
effort: 1-2h
created: 2026-02-21
issue: https://github.com/8f4e/8f4e/issues/552
status: Completed
completed: 2026-09-30
---

# TODO: Remove Unused Editor-Core Feature-Flag Configuration

## Problem Description

Feature-flag defaults and validation currently exist in two places:

- `packages/editor/packages/editor-core/src/config/featureFlags.ts`
- `packages/editor/packages/editor-core/packages/editor-state/src/pureHelpers/state/featureFlags.ts`

The editor-state implementation is the live source used during state initialization. The editor-core copy is not
imported by production code or exported from the package; only its colocated unit test and an editor-core integration
test import it. Maintaining that test-only copy creates drift risk and makes a dead module look like part of the editor's
runtime configuration path.

## Proposed Solution

Keep the editor-state implementation as the sole owner of feature-flag defaults and validation. Delete the unused
editor-core module and the tests that exercise only that copy. Move any distinct, still-useful behavioral assertion to
the editor-state feature-flag tests rather than retaining an alias or re-export.

## Anti-Patterns

- Do not replace the dead editor-core module with a re-export when no production consumer needs that module path.
- Do not introduce a dependency from editor-state back to editor-core.
- Do not change the live feature-flag defaults as part of this cleanup; removals of specific flags belong in their own
  focused task.
- Do not preserve duplicate tests that prove only that two implementations currently behave the same way.

## Implementation Plan

### Step 1: Confirm the live ownership boundary

- Verify that editor-state initialization imports `defaultFeatureFlags` and `validateFeatureFlags` from its local
  `pureHelpers/state/featureFlags.ts` module.
- Confirm that the editor-core copy has no production imports or package exports.

### Step 2: Remove the unused copy

- Delete `packages/editor/packages/editor-core/src/config/featureFlags.ts`.
- Delete the editor-core unit and integration tests whose subject is the unused copy.
- If either test contains a unique contract worth preserving, add the narrow assertion to editor-state's initialization
  coverage or a new focused test beside the canonical implementation.

### Step 3: Verify the public configuration path

- Confirm that `EditorOptions.featureFlags` still reaches editor-state initialization unchanged.
- Verify that partial overrides continue to merge with the canonical defaults.
- Update documentation only if it refers to the removed editor-core module path.

## Validation Checkpoints

- `rg -n "src/config/featureFlags|defaultFeatureFlags|validateFeatureFlags" packages/editor`
- `npx nx run @8f4e/editor-state:test`
- `npx nx run @8f4e/editor-state:typecheck`
- `npx nx run @8f4e/editor-core:test`
- `npx nx run @8f4e/editor-core:typecheck`

## Success Criteria

- [x] `packages/editor/packages/editor-core/src/config/featureFlags.ts` no longer exists.
- [x] Exactly one live `defaultFeatureFlags` and `validateFeatureFlags` implementation remains.
- [x] No compatibility re-export or fallback module is retained.
- [x] Partial feature-flag overrides retain their current behavior through editor initialization.
- [x] Relevant editor-state and editor-core tests and typechecks pass.

## Affected Components

- `packages/editor/packages/editor-core/src/config/featureFlags.ts` - remove the unused duplicate implementation.
- `packages/editor/packages/editor-core/src/config/featureFlags.test.ts` - remove tests for the dead implementation.
- `packages/editor/packages/editor-core/src/integration/featureFlags.test.ts` - remove or migrate assertions that target
  the dead module.
- `packages/editor/packages/editor-core/packages/editor-state/src/pureHelpers/state/featureFlags.ts` - retain as the
  canonical implementation.
- `packages/editor/packages/editor-core/packages/editor-state/src/index.test.ts` - receive any uniquely valuable
  initialization behavior coverage.

## Risks & Considerations

- **Hidden imports**: A repository-wide search and editor-core typecheck should confirm that no generated or indirect
  source imports the old path.
- **Concurrent flag cleanup**: If individual flags are removed first, migrate assertions against the resulting canonical
  flag set rather than restoring obsolete flags to satisfy the old tests.
- **Issue wording**: GitHub issue #552 describes consolidation; direct deletion is the now-appropriate form of that
  consolidation because the second implementation has no production consumer.

## Related Items

- **Related**: `docs/todos/archived/488-remove-disabled-editor-debug-overlays.md`

## Notes

The implementation direction was clarified by a repository audit on 2026-09-30: the editor-core module is test-only,
so retaining a forwarding module would preserve unused surface without serving a compatibility requirement.

Completed on 2026-09-30 by deleting the unused editor-core implementation and its duplicate tests, then adding focused
coverage beside the canonical editor-state implementation.

## Archive Instructions

Set `status: Completed` and the completion date, move this file to `docs/todos/archived/`, and update
`docs/todos/_index.md`.
