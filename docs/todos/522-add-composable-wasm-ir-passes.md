---
title: 'TODO: Add composable Wasm IR passes'
priority: Medium
effort: TBD
created: 2026-11-11
issue: null
status: Open
completed: null
---

# TODO: Add composable Wasm IR passes

## Problem Description

The compiler statically imports the function inliner, Wasm IR pruner, and local simplifier and selects them through
compiler options. Disabling a pass still leaves its implementation in the compiler's dependency graph. Usage sites
cannot supply their own transformations or choose the order of passes between Wasm lowering and code generation.

The inliner also imports the pruner and removes unreachable functions between expansion rounds. This couples two
transformations that should be independently selectable.

## Proposed Solution

Accept an ordered list of synchronous Wasm IR passes at the compiler boundary. Each pass has a diagnostic name and
a transformation from `WasmIR` to `WasmIR`, for example:

```ts
interface WasmIRPass {
	readonly name: string;
	transform(ir: WasmIR): WasmIR;
}
```

Keep pass implementations out of the compiler core's runtime imports. Usage sites choose their passes, load the
required packages asynchronously, and provide resolved pass instances to the synchronous transformation pipeline.
Pass factories own their configuration, including inlining limits. An explicit empty list emits the lowered module
without optional transformations. Define omission and default behavior at the consumer composition boundary.

Use this order when the standard optimization passes are selected:

```text
lower → inline → prune → simplify → codegen
```

Inlining expands calls while retaining function definitions. Pruning subsequently removes unreachable definitions
and compacts unused locals. Simplification rewrites the retained bodies. Each pass remains usable independently.

Separate read-only call-graph analysis from deletion. The inliner recomputes reachability between rounds and counts
calls only in reachable bodies, ignoring retained unreachable functions when selecting and applying expansions.
Preserve recursion handling and each caller's accumulated growth budget across rounds. Shared analysis utilities may
serve both passes, but the inliner must no longer import or invoke the pruning transformation.

The editor loads selected implementations inside the compiler worker. Its main thread sends serializable pass IDs
and settings; executable pass objects remain inside the worker. Keep the lazy import registry in the worker's
composition layer so the compiler stays independent of known plugin names. The CLI dynamically imports the packages
selected by its flags. Reuse loaded modules across compilations and verify production worker code splitting.

## Implementation Plan

1. Define and document the pass contract and ordered execution hook after complete module lowering and before
   emission. Wrap failures with the pass name, preserve inputs, and keep compiler metadata assembled separately.
2. Decouple inlining from pruning using read-only reachability analysis. Remove the inliner's pruning option and
   package dependency, retaining unused definitions until an explicit pruning pass runs.
3. Expose configurable pass factories from the existing optimization packages and remove their static imports from
   compiler orchestration. Keep memory guards and assertion planning as their existing lowering options.
4. Adapt editor worker composition and CLI flag handling to build the selected pass list lazily. Map existing
   configuration to consumer-owned defaults and document any API migration.
5. Validate independent passes, combined execution, lazy loading, and emitted program behavior. Update compiler
   architecture documentation and consumer examples.

## Success Criteria

- [ ] Callers can supply, order, repeat, or omit Wasm IR passes, including custom transformations.
- [ ] An empty pass list performs lowering and emission without optional optimization implementations.
- [ ] The compiler core has no runtime dependency on the inliner, pruner, or simplifier implementations.
- [ ] Inlining works independently, retains definitions, ignores unreachable callers, and preserves growth limits
      across rounds; pruning remains responsible for deletion and local compaction.
- [ ] The standard selected pipeline runs inlining before pruning, followed by simplification and emission.
- [ ] Editor worker and CLI imports load only selected passes; worker messages contain serializable configuration.
- [ ] Targeted Nx checks cover ordering, independent pass combinations, recursion, exports, unreachable callers,
      unused locals, and growth limits. Compiler fixtures preserve runtime behavior and metadata contracts.
- [ ] Production editor build artifacts confirm unused passes are absent from the initial worker chunk and selected
      passes load successfully on demand.

## Affected Components

- `packages/compiler/src/` and `packages/compiler/packages/language-spec/src/options.ts` - Public compiler options
  and the distinction between executable passes and serializable consumer configuration.
- `packages/compiler/packages/sub-program/src/compileSubProgram.ts` - Ordered transformation hook and stage errors.
- `packages/compiler/packages/sub-program/packages/function-inliner/` - Reachability analysis, pass factory, and
  removal of the pruner dependency.
- `packages/compiler/packages/sub-program/packages/wasm-ir-pruner/` and `wasm-ir-simplifier/` - Independent pass
  factories and shared call-graph analysis where appropriate.
- `packages/editor/packages/compiler-worker/` and `packages/editor/plugins/compiler/` - Worker-side lazy loading,
  serializable selection, and existing editor configuration.
- `packages/cli/src/compile/` - Flag-to-pass selection and lazy package imports.
- Compiler package dependencies, build configuration, consumer documentation, and compiler pipeline tests.

## Risks & Considerations

`WasmIR` becomes a supported extension contract. Passes must preserve program behavior, required exports, the shared
memory ABI, and the relationship between generated code and source metadata. Treat declared memory as observable
through the editor, including when a transformation removes source functions from emitted code.

Moving local compaction after inlining can affect expansion sizes and the local-slot limit. Check those decisions
alongside call counts rather than assuming byte-identical output from the reordered pipeline. Keep asynchronous
loading outside the transformation loop and preserve compilation scheduling when a worker awaits its first import.

## Related Items

- [TODO 521: Benchmark Wasm IR simplifications](521-benchmark-wasm-ir-simplifications.md) - Consumers should be able
  to select benchmark passes independently.
- [TODO 452: Add reachability-based function pruning](452-add-reachability-based-function-pruning.md) - Related
  reachability and pruning behavior; reconcile with the current symbolic IR implementation during implementation.

## References

- [Compiler design](../../packages/compiler/docs/compiler-design.md#wasm-module-lowering-and-optimization)
- [Wasm IR contract](../../packages/compiler/packages/language-spec/src/wasmIR.ts)
- [Compiler worker](../../packages/editor/packages/compiler-worker/README.md)

## Notes

Agreed direction: usage sites compose optional IR transformations and load them when needed. Inlining precedes
pruning, and the inliner uses reachability analysis without deleting definitions. This TODO records future work;
it does not change the current compiler pipeline.

## Archive Instructions

When completed, set `status: Completed` and the completion date, move this file to `docs/todos/archived/`, and move
its entry in `docs/todos/_index.md` from Active TODOs to Completed TODOs.
