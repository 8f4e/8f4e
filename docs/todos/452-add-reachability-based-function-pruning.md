---
title: 'TODO: Add Reachability-Based Function Pruning'
priority: Medium
effort: 1-2d
created: 2026-06-10
issue: https://github.com/8f4e/8f4e/issues/946
status: Open
completed: null
---

# TODO: Add Reachability-Based Function Pruning

## Problem Description

The compiler now prunes functions whose metadata remains unmarked after the current compile-time marking pass. This removes clearly uncalled functions from the emitted output, but it is still conservative around nested function calls.

Because the current marking pass compiles every function before pruning, a function that is only called from an otherwise uncalled function is still marked as used. The parent can be pruned, but the nested callee remains in the output.

## Proposed Solution

Add a dedicated reachability pass before final WebAssembly indexes are assigned and before code emission runs.

The pass should:
- seed roots from exported functions and calls made by executable modules/constants;
- resolve calls with the same overload/type rules used by normal compilation;
- recursively walk only newly reachable function bodies;
- assign final compact function indexes after reachability is known;
- compile only reachable functions into the final output.

## Implementation Plan

### Step 1: Extract Call Marking Analysis
- Add a function-body analysis path that normalizes and stack-analyzes lines without emitting bytecode.
- Reuse the existing `call` resolution logic so overload selection stays consistent.

### Step 2: Build Reachability Roots
- Analyze modules/constants to mark functions called directly from executable code.
- Keep exported functions as roots.

### Step 3: Walk Reachable Functions
- Traverse function bodies from the root set until no new concrete function metadata entries are marked.
- Ignore functions that are not reached from a root, even if their bodies call other functions.

### Step 4: Emit From Reachable Set
- Reassign imported and defined function indexes after pruning.
- Compile only reachable functions and final modules with the compact registry.

## Success Criteria

- [ ] Uncalled functions are omitted from `compiledFunctions` and the emitted WebAssembly sections.
- [ ] Functions only called by uncalled functions are also omitted.
- [ ] Exported functions remain emitted even when not called internally.
- [ ] Overloaded functions prune per concrete signature, not by shared source name.
- [ ] Final WebAssembly call indexes remain valid after pruning.

## Affected Components

- `packages/compiler/packages/sub-program/src/compileSubProgram.ts` - current conservative pruning and future reachability orchestration.
- `packages/compiler/src/compileFunction.ts` - likely source for a reusable analysis-only function-body walk.
- `packages/compiler/src/stackAnalysis/` - call resolution and stack effects that should be reused.

## Risks & Considerations

- **Index stability**: final WebAssembly indexes must be assigned after the reachable set is known.
- **Overload resolution**: reachability must operate on concrete function ids, not only source names.
- **Diagnostics**: decide whether unreachable invalid function bodies should still report compiler errors.

## Related Items

- **Related**: `435-add-polymorphic-function-overloads.md`
