---
title: 'TODO: Extract semantic reference resolver'
priority: High
effort: 4-8h
created: 2026-06-17
issue: null
status: Completed
completed: 2026-06-17
---

# TODO: Extract Semantic Reference Resolver

## Problem Description

Semantic value and reference resolution is currently duplicated across compiler passes.

Both `@8f4e/stack-analyzer` and `@8f4e/wasm-codegen` own a `normalizeValueArguments.ts` entrypoint and a parallel
`normalization/` directory. Most files are direct duplicates, while some differ because codegen still carries
namespace-discovery deferral behavior.

This means analyzer and codegen can drift while resolving the same language constructs:

- memory/layout expressions such as address, count, sizeof, min, and max references;
- identifier references for memory declarations, locals, and intermodule targets;
- inline call arguments;
- map, default, loop, clamp-address, memory-copy, and memory-declaration value positions;
- push and pushShape reference enrichment.

The compiler pipeline should resolve these semantic references once, before stack analysis and codegen. Downstream
passes should consume the unchanged project AST plus a semantic reference report instead of replaying the same semantic
pass line by line.

## Proposed Solution

Create a standalone compiler pass package, likely named `@8f4e/semantic-reference-resolver` or
`@8f4e/value-reference-resolver`.

The pass should run once in `compileSubProgram`, after:

1. constant resolution;
2. memory planning;
3. memory reference inlining;
4. memory default resolving;
5. namespace and function metadata collection.

It should run before:

1. stack analysis;
2. wasm codegen.

The pass should accept the full project AST plus the already-built semantic facts it needs, then return reusable report
data required by downstream passes without mutating or widening the AST.

## Anti-Patterns

- Do not keep transitional callback APIs or compatibility wrappers for the old analyzer/codegen entrypoints.
- Do not keep separate analyzer and codegen copies of the same line-resolution logic.
- Do not preserve codegen-only namespace deferral once the resolver runs after namespace/function metadata collection.
- Do not call the pass from inside stack analysis or codegen; it should be a project-level compiler pipeline step.
- Do not use "normalization" as the primary concept if the pass is really resolving semantic references.

## Implementation Plan

### Step 1: Define the Pass Boundary

- Add the new package with a README that states ownership clearly.
- Define a project-level input containing resolved constants, inlined memory references, memory plan, defaults,
  pointer metadata, namespaces, function registry, function type registry, memory regions, and prototype shapes.
- Define an output that includes shared per-line semantic facts keyed back to the original project AST.

### Step 2: Move Shared Resolution Logic

- Move the duplicated `normalizeValueArguments` and `normalization/*` logic out of `stack-analyzer` and `wasm-codegen`.
- Remove analyzer/codegen-owned copies instead of re-exporting them from compatibility paths.
- Collapse the current defer-vs-validate differences now that the pass runs after namespace metadata exists.

### Step 3: Update the Pipeline

- Call the resolver once from `compileSubProgram`.
- Pass the unchanged AST and semantic reference report to `analyzeStack`.
- Pass the same unchanged AST, semantic reference report, and stack report to `compileModules` and `compileFunction`.
- Remove line-by-line semantic reference resolution from analyzer and codegen loops.

### Step 4: Shrink Shared Utilities

- Re-check `@8f4e/semantic-utils` after the resolver extraction.
- Move language-rule helpers to `@8f4e/language-spec` when they describe the language rather than a pass.
- Move pass-local helpers into their owning package.

### Step 5: Add Regression Coverage

- Add tests proving stack analysis and wasm codegen consume the same resolved forms.
- Cover inline call arguments, intermodule memory references, map/default values, memory declarations, and pointer pushes.
- Prefer project-level tests for the new pass over duplicated analyzer/codegen tests.

## Validation Checkpoints

- `npx nx run @8f4e/semantic-reference-resolver:test`
- `npx nx run @8f4e/stack-analyzer:test`
- `npx nx run @8f4e/wasm-codegen:test`
- `npx nx run @8f4e/compiler:test`
- `npx nx run-many --target=typecheck --projects=@8f4e/compiler,@8f4e/stack-analyzer,@8f4e/wasm-codegen`
- `rg -n "normalizeValueArguments|src/normalization" packages/compiler/packages/stack-analyzer packages/compiler/packages/wasm-codegen`

## Success Criteria

- [x] Semantic reference resolution runs once per project compilation.
- [x] `stack-analyzer` no longer owns `normalizeValueArguments` or a `normalization/` directory.
- [x] `wasm-codegen` no longer owns semantic reference resolution.
- [x] Analyzer and codegen consume the same semantic reference report alongside the unchanged project AST.
- [x] Namespace-discovery deferral logic is removed instead of preserved as a fallback.
- [x] `compileSubProgram` remains the orchestrator of compiler passes.

## Affected Components

- `packages/compiler/src/compileSubProgram.ts` - should call the new pass between metadata collection and stack analysis.
- `packages/compiler/packages/stack-analyzer/` - should consume resolved lines instead of resolving them.
- `packages/compiler/packages/wasm-codegen/` - should generate wasm from resolved lines and stack facts only.
- `packages/compiler/packages/semantic-utils/` - should shrink after shared pass-local helpers move away.
- `packages/compiler/packages/language-spec/` - may receive language-rule helpers that are not pass-specific.

## Risks & Considerations

- **Error ownership**: Existing error timing may shift earlier. Keep semantic errors tied to the resolver stage and avoid
  defensive downstream revalidation.
- **Line metadata**: Resolved lines must preserve source line and project block metadata for diagnostics.
- **Type shape**: Avoid generic "resolved enough" types. The output contract should make downstream assumptions explicit.
- **Test churn**: Analyzer/codegen tests may need to assert resolved inputs rather than raw parser shapes.

## Related Items

- **Related**: `docs/todos/406-review-compiler-namespace-prepass-repetition.md`
- **Related**: `docs/todos/432-centralize-compile-time-metadata-query-resolution.md`
- **Related**: `docs/todos/461-decouple-language-spec-from-wasm-output-contracts.md`
