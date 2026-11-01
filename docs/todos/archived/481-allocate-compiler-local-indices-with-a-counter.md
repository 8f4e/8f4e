---
title: 'TODO: Centralize compiler local allocation'
priority: Medium
effort: 2-4h
created: 2026-09-06
issue: https://github.com/8f4e/8f4e/issues/956
status: Completed
completed: 2026-10-01
---

# TODO: Centralize Compiler Local Allocation

## Problem Description

The compiler has no single owner for creating local bindings. Parameter registration, source-level local declarations,
loop counters, arithmetic temporaries, map temporaries, and memory guards each calculate an index, construct a binding,
and insert it into `context.locals` themselves.

That spreads the local-allocation contract across semantic reference resolution, stack analysis, and Wasm code
generation. A new instruction that needs a temporary must know how indices are assigned, when an existing binding may
be reused, how multiple slots remain consecutive, and which context resets also reset the local namespace. The current
call sites express those rules with several slightly different implementations rather than one explicit API.

Most call sites also derive an index with `Object.keys(context.locals).length`. Memory guards instead use
`Math.max(-1, ...Object.values(context.locals).map(local => local.index)) + 1`. Besides duplicating policy, these
expressions enumerate the whole local map and make allocating N locals require quadratic work.

## Implemented Solution

Local allocation now has one shared owner in `@8f4e/semantic-utils`. The name-to-binding map remains available for
lookups, while binding creation and namespace resets go through a small API. A per-context `nextLocalIndex` counter is
the implementation detail that makes allocation constant-time; callers do not increment or synchronize it directly.

The API provides these operations:

- `allocateLocal(context, name, binding)`: assigns the next index, inserts the binding, advances the counter, and returns
  the completed binding.
- `allocateLocalFromType(context, name, type)`: constructs and allocates a binding from a source-language function value
  type.
- `getOrCreateLocal(context, name, binding)`: returns an existing binding without advancing the counter, or allocates it
  through the same path when absent.
- `resetLocals(context)`: clears the binding map and resets the next index together.

The same contract is used across compiler stages, with independent allocator state for each context. Code generation
can allocate hidden temporaries that semantic analysis does not need, so stages do not share allocator state or assume
identical final local counts.

- Parameters remain first, including expanded `paramShape` parameters. After parameters, source locals and generated
  temporaries receive indices in compiler traversal order without a separate declaration prepass.
- The two integer min/max locals and four map locals use repeated named allocation rather than exposing a raw multi-slot
  reservation API.
- Every local-table reset uses the shared reset helper.
- Test contexts seeded with bindings derive the next index once in `createCompilationContext` from the highest existing
  index. Production compilation continues to build dense local tables from an empty context.
- Direct writes that create bindings have been removed. Reads and updates to metadata on an existing binding remain
  direct where appropriate.
- Final local-declaration emission may enumerate the completed map once; allocation paths do not enumerate it.

This task centralizes bookkeeping rather than defining new language semantics. Keep existing declaration diagnostics
unchanged. Duplicate user-local names and collisions between user names and compiler-generated temporary names are a
separate concern; the helper contract must make existing-name handling explicit for each operation without silently
inventing a new diagnostic or shadowing rule.

Internal context and helper APIs may change directly because the project has not been released. No compatibility shim
or repeated internal invariant checks are needed.

## Implementation Summary

1. Added `nextLocalIndex` to shared compilation contexts and initialized seeded contexts once from their highest binding
   index.
2. Added allocation, typed-allocation, get-or-create, and reset helpers with focused unit tests.
3. Routed semantic reference resolution, stack analysis, and Wasm codegen through the shared helpers.
4. Migrated parameters, source locals, loop counters, arithmetic temporaries, map temporaries, and memory guards.
5. Audited remaining local-map enumeration so only context initialization and final Wasm declaration emission enumerate
   completed maps.
6. Verified compiler behavior with targeted tests, repository-wide typechecking, and before/after scaling measurements.

## Success Criteria

- [x] Every new `LocalBinding` in the affected stages is created through the shared allocation API; call sites contain
      no local-index derivation or counter mutation.
- [x] Binding-map and counter state remain synchronized across allocation, reuse, and reset operations.
- [x] Parameters retain their leading indices and are excluded from emitted local declarations.
- [x] Mixed int/float/float64 bindings and generated temporaries receive unique indices in compiler traversal order.
- [x] Reusing a binding does not advance the counter, and allocating several named temporaries advances it once per
      binding.
- [x] Function/module contexts remain independent, and local-table resets also reset allocator state.
- [x] Seeded test contexts allocate above their highest existing index without rescanning on each allocation. This does
      not make sparse local maps a supported Wasm-emission format.
- [x] Runtime behavior and existing declaration diagnostics are preserved; ordinary dense-index fixtures emit identical
      Wasm when compared independently of other codegen changes.
- [x] Seeded-context initialization and final declaration emission are the only remaining full enumerations of local
      maps in allocation-related code.

## Performance Expectations

Performance is a secondary benefit of centralizing the contract. Replacing repeated map enumeration with a counter
reduces index assignment from quadratic to linear total work as local counts grow. It does not inherently reduce local
count, Wasm size, or generated-program runtime.

A public-API benchmark on 2026-10-01 compiled generated modules containing only local declarations before and after the
shared allocator change. After three warmup runs, the median of nine samples showed that the counter removed the
superlinear growth:

| Locals | Before, cold cache | Before, warm cache | After, cold cache | After, warm cache |
| ---: | ---: | ---: | ---: | ---: |
| 100 | 1.268 ms | 0.649 ms | 0.854 ms | 0.242 ms |
| 500 | 16.860 ms | 15.368 ms | 2.038 ms | 1.046 ms |
| 1,000 | 70.994 ms | 69.015 ms | 3.677 ms | 1.420 ms |
| 2,000 | 333.152 ms | 322.048 ms | 6.712 ms | 3.363 ms |

These synthetic results verify the scaling improvement but do not establish a user-visible improvement for ordinary
projects, whose individual blocks currently contain far fewer locals. Future measurements should retain warmup,
repeated samples, several input sizes, and both cold and warm AST-cache compilation.

## Affected Components

- `packages/compiler/packages/language-spec/src/semantic.ts` and relevant codegen context types
- `packages/compiler/packages/sub-program/packages/semantic-utils/src/createCompilationContext.ts`
- `packages/compiler/packages/sub-program/packages/semantic-reference-resolver/src/index.ts`
- `packages/compiler/packages/sub-program/packages/stack-analyzer/src/analyzeStack.ts`
- `packages/compiler/packages/wasm-codegen/src/instructionCompilers/` local and temporary allocation sites
- `packages/compiler/packages/wasm-codegen/src/instructionCompilers/utils/memoryAccessGuard.ts`

## Validation Checkpoints

- `npx nx run-many --target=test --projects=@8f4e/semantic-utils,@8f4e/semantic-reference-resolver,@8f4e/stack-analyzer,@8f4e/wasm-codegen,@8f4e/compiler`
- `npx nx run-many --target=typecheck --all`
- Inspect remaining local-map enumeration: final declaration emission may still enumerate once, but allocation must not.
- Validate emitted Wasm and run mixed parameter/local/temporary fixtures, including multiple functions and nested loops.
- Add helper-level coverage for empty, dense, and sparse seeded contexts, get-or-create reuse, and reset behavior.

## Related Items

- [TODO 480: Simplify map codegen with reverse row order](480-simplify-map-codegen-with-reverse-row-order.md) — coordinate
  changes to map temporary allocation if both tasks are implemented together; neither depends on the other.
