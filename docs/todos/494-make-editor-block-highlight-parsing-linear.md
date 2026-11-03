---
title: 'TODO: Measure editor block-highlight parser scaling'
priority: Medium
effort: 3-6h
created: 2026-10-14
issue: https://github.com/8f4e/8f4e/issues/1011
status: Open
completed: null
---

# TODO: Measure editor block-highlight parser scaling

## Problem Description

The editor's block-highlight parser already tracks the open-block count incrementally, uses a `Map` of stacks keyed
by closing instruction, and keeps a separate stack of open `if` branches. It avoids full-history scans and temporary
array copies when matching closing instructions and `else`.

Highlight parsing runs when the code-rendering plugin prepares its private cache after layout changes. What remains
unverified is the measured latency and allocation growth for large blocks. Existing correctness tests cover tolerant
matching, but no benchmark yet demonstrates the expected approximately linear block-tracking cost.

## Proposed Solution

Benchmark the current parser on increasing source sizes with many short sibling constructs, deep nesting, and
incomplete or mismatched blocks. Record runtime and allocations with a reproducible procedure. Measure parser work
separately from complete highlight preparation so the results distinguish block tracking from layout calculations.

Use the existing tolerant-matching tests as a correctness guard. Preserve highlight order, line numbers, depths,
and malformed-input behavior in any optimization justified by the measurements.

## Implementation Plan

1. Reuse the existing correctness cases for nested and sibling blocks, `if`/`else`, unfinished blocks, and unmatched
   or mismatched closing instructions.
2. Benchmark increasing source sizes with a documented warm-up and repeated samples, recording runtime and allocations.
3. Report parser scaling and complete highlight-preparation costs. Investigate further only where measurements reveal
   a remaining bottleneck.

## Success Criteria

- [x] The implementation tracks open-block counts and matching stacks incrementally without full-history searches or array copies.
- [x] Tests cover result ordering, depths, and start/end line numbers for complete and incomplete source.
- [x] Tests cover `else`, stray closers, and mismatched nesting.
- [ ] Reproducible measurements document runtime and allocation growth across increasing source sizes.
- [ ] Results assess approximately linear block-tracking growth and report complete highlight-preparation costs.

## Affected Components

- `packages/editor/plugins/code-rendering/src/block-highlights/parseHighlightBlocks.ts`
- `packages/editor/plugins/code-rendering/src/block-highlights/deriveBlockHighlights.ts`
- Block-highlight parser and geometry tests, plus benchmark results.

## Risks & Considerations

- The existing parser can find a matching open block behind a differently typed open block. Replacing it with only
  a single strict stack would alter behavior for partially edited source.
- Repeated `else` and incomplete nesting need explicit coverage when maintaining separate lookup stacks.
- Avoid moving semantic or syntax validation into the editor's tolerant highlight parser.

## Validation Checkpoints

- Run `npx nx run @8f4e/editor-plugin-code-rendering:test` and its typecheck.
- Run the documented benchmark procedure and retain results for sibling, nested, and incomplete source.

## Related Items

- [Make parser stateful for block pairing and owning block context](378-make-parser-stateful-for-block-pairing-and-owning-block-context.md)
  concerns the language parser. Coordinate any reusable structural metadata without making live highlights depend
  on successful compilation.
