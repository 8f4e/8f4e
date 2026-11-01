---
title: 'TODO: Make editor block-highlight parsing linear'
priority: Medium
effort: 3-6h
created: 2026-10-14
issue: https://github.com/8f4e/8f4e/issues/1011
status: Open
completed: null
---

# TODO: Make editor block-highlight parsing linear

## Problem Description

The editor's block-highlight parser counts open blocks by reducing over all previously discovered blocks on every
source line. Closing instructions and `else` also copy, reverse, and search that array to find an open block.

This can produce quadratic work and repeated temporary allocations in large code blocks. Highlight parsing runs
as part of block derived-state updates. The actual latency impact has not yet been benchmarked.

## Proposed Solution

Keep the ordered result array, but track the open-block count separately and use a `Map` of open-block stacks keyed
by closing instruction to locate matching blocks directly. Track open `if` branches separately if needed to preserve
the current `else` matching behavior.

The parser must continue to tolerate incomplete source while the user types. Preserve highlight order, line numbers,
depths, and current matching behavior, including malformed input; a strict nesting stack alone may change it.

## Implementation Plan

1. Capture current output for nested and sibling blocks, `if`/`else`, unfinished blocks, and unmatched or mismatched
   closing instructions. Measure parsing on large blocks with many short sibling constructs as well as deep nesting.
2. Replace repeated open-count scans and reverse searches with incrementally maintained per-parse lookup state.
3. Verify equivalent highlight output and compare scaling and allocations against the baseline.

## Success Criteria

- [ ] Each source line requires bounded block-tracking work, independent of previously closed blocks.
- [ ] The implementation avoids per-closing-instruction array copies and full-history searches.
- [ ] Result ordering, depths, and start/end line numbers remain correct for complete and incomplete source.
- [ ] `else`, stray closers, mismatched nesting, and supported instruction pairs retain current editor behavior.
- [ ] Measurements demonstrate approximately linear block-tracking growth and report end-to-end parsing costs.

## Affected Components

- `packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/features/blockHighlights/codeParser.ts`
- `packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/features/blockHighlights/updateGraphicData.ts`
- Block-highlight parser and graphic-data tests.

## Risks & Considerations

- The existing parser can find a matching open block behind a differently typed open block. Replacing it with only
  a single strict stack would alter behavior for partially edited source.
- Repeated `else` and incomplete nesting need explicit coverage when maintaining separate lookup stacks.
- Avoid moving semantic or syntax validation into the editor's tolerant highlight parser.

## Validation Checkpoints

- Run `npx nx run @8f4e/editor-state:test` and its typecheck.
- Manually edit nested control-flow constructs and check highlight placement before their closing lines are complete.

## Related Items

- [Make parser stateful for block pairing and owning block context](378-make-parser-stateful-for-block-pairing-and-owning-block-context.md)
  concerns the language parser. Coordinate any reusable structural metadata without making live highlights depend
  on successful compilation.
