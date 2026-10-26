---
title: 'TODO: Index compiled functions by project block ID'
priority: Medium
effort: 2-4h
created: 2026-10-14
issue: https://github.com/8f4e/8f4e/issues/1010
status: Open
completed: null
---

# TODO: Index compiled functions by project block ID

## Problem Description

`getCompiledFunctionForCodeBlock` allocates an array with `Object.values()` and scans all compiled functions to match
`func.ast.projectBlockId` against a code block's `creationIndex`. Function-block layout calls this helper twice per
derived-state update, and stack widgets and tooltips also use it.

Updating all function blocks therefore performs quadratic lookup work as the function count grows. This is a
candidate identified by code inspection; its contribution to editor latency has not been measured.

## Proposed Solution

Build a `Map<number, CompiledFunction>` keyed by `ast.projectBlockId` once for each accepted compilation result and
reuse it across layout, stack-widget, and tooltip lookups. Keep the existing function registry where its original
keys are needed; this is a secondary index rather than a wholesale object-to-Map conversion.

## Implementation Plan

1. Measure current lookup and derived-state update costs with projects containing many functions.
2. Choose an index owner and invalidation mechanism tied to compiled-function replacement, including project reset
   and recompilation. Ensure subscribers never observe an index from a different compilation result.
3. Route the shared lookup helper through the index so existing callers benefit without separate caches.
4. Add focused regression coverage and compare the same workload after the change, including index construction.

## Success Criteria

- [ ] Repeated function lookups avoid `Object.values()` allocation and full-registry searches.
- [ ] The index is built once per relevant compilation result, rather than once per block or lookup.
- [ ] Recompilation, function deletion, project replacement, and missing compiled functions return correct results.
- [ ] Function layout, stack widgets, and tooltips preserve their current behavior.
- [ ] Before/after measurements include index construction and document the observed benefit and memory cost.

## Affected Components

- `packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/utils/getCompiledFunctionForCodeBlock.ts`
- `packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/paramShape/updateGraphicData.ts`
- `packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/features/directives/stack/resolve.ts`
- `packages/editor/packages/editor-plugin-tooltips/src/state/effect.ts`
- `packages/editor/packages/editor-core/packages/editor-state/src/features/program-compiler/effect.ts`
- Editor state types and defaults if the index is stored in state.

## Risks & Considerations

- Stale indexes can associate a block with an obsolete function after project replacement or recompilation.
- Preserve the existing first-match behavior if duplicate project block IDs can reach the lookup; establish that
  invariant before relying on Map overwrite behavior.
- Small projects may see little benefit, so include index maintenance in the measurements.

## Validation Checkpoints

- Run `npx nx run @8f4e/editor-state:test` and affected typechecks.
- Exercise function layout, stack directives, and tooltips after adding, deleting, and recompiling functions.

## Related Items

- [Optimize global editor directive recomputation](315-optimize-global-editor-directive-recomputation.md) addresses a
  separate source of repeated editor work.
