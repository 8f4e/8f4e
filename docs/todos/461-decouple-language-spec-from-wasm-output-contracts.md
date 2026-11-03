---
title: 'TODO: Decouple language-spec from WASM output contracts'
priority: Medium
effort: 1-2d
created: 2026-06-16
issue: https://github.com/8f4e/8f4e/issues/951
status: Open
completed: null
---

# TODO: Decouple Language-Spec From WASM Output Contracts

## Problem Description

`@8f4e/language-spec` should describe the 8f4e language and shared compiler-facing contracts, but it still owns several
WebAssembly-specific output and runtime shapes.

This makes the package less target-neutral than its name suggests and creates pressure for future code generators to
depend on WASM concepts even when they target a different bytecode or runtime.

Current examples include:

- `@8f4e/compiler-wasm-utils` imports from language-spec source files.
- compiled output shapes such as `CompiledFunction.typeIndex`, `FunctionMetadata.wasmIndex`, and
  `CompileResult.codeBuffer`.
- WASM type registries such as `FunctionTypeRegistry` and `FunctionTypeSignature`.
- runtime contracts that expose `WebAssembly.Memory`, `WebAssembly.Instance`, and code buffers.
- constants or options documented in terms of WASM pages, memory indexes, or shared-memory behavior.

## Proposed Solution

Keep language-spec focused on source-level and target-neutral language facts:

- AST and parsed instruction shapes.
- source-level function value types and signatures.
- instruction metadata that is true before choosing a backend.
- diagnostic codes and shared diagnostic data shapes.
- target-neutral memory layout facts such as declaration addresses, sizes, and element types.

Move WASM emission and runtime contracts to `@8f4e/wasm-codegen` or a small WASM-specific contract package owned by that
backend.

## Anti-Patterns

- Do not move target-neutral memory layout facts out of language-spec only because the current backend is WASM.
- Do not make future bytecode targets depend on `@8f4e/compiler-wasm-utils`.
- Do not preserve compatibility re-exports in language-spec for moved WASM-only contracts; the software is unreleased.
- Do not hide WASM-specific names behind generic names while the shape still encodes WASM concepts.

## Implementation Plan

### Step 1: Classify Language-Spec Exports

- Audit language-spec exports for target-neutral language facts versus WASM backend contracts.
- Decide which package should own each WASM-specific type or constant.
- Keep source-level names in place when only the comments mention WASM but the data is target-neutral.

### Step 2: Move WASM Output Contracts

- Move compiled module/function output types that contain WASM indexes, type indexes, code buffers, or function type
  registries into the WASM backend package.
- Replace language-spec imports in compiler and runtime consumers with the new backend-owned imports.
- Remove `@8f4e/compiler-wasm-utils` from language-spec dependencies when no remaining source file needs it.

### Step 3: Move WASM Runtime Contracts

- Move runtime instance, memory, and code-buffer contracts out of language-spec.
- Keep only target-neutral compiler result metadata in language-spec if it is shared by non-WASM backends.
- Update compiler-worker, runtime packages, CLI, and tests to import WASM runtime contracts from the WASM-specific owner.

### Step 4: Validate Package Boundaries

- Confirm language-spec no longer imports WASM utilities.
- Confirm WASM codegen still owns all WebAssembly emission details.
- Confirm target-neutral compiler passes can depend on language-spec without pulling in a backend.

## Validation Checkpoints

- `rg -n "@8f4e/compiler-wasm-utils|WebAssembly|WASM|Wasm|wasmIndex|typeIndex|FunctionTypeRegistry|byteCode|codeBuffer" packages/compiler/packages/language-spec/src`
- `npx nx run @8f4e/language-spec:test`
- `npx nx run @8f4e/language-spec:typecheck`
- `npx nx run @8f4e/wasm-codegen:test`
- `npx nx run @8f4e/compiler:test`
- `npx nx run @8f4e/editor-website:build`

## Success Criteria

- [ ] `@8f4e/language-spec` has no dependency on `@8f4e/compiler-wasm-utils`.
- [ ] WASM type registries and compiled WASM output shapes are owned by the WASM backend.
- [ ] Runtime `WebAssembly.*` contracts are not exported from language-spec.
- [ ] Target-neutral language, AST, diagnostics, and memory layout facts remain available without importing a backend.
- [ ] Existing compiler, codegen, worker, runtime, and app builds pass after import updates.

## Affected Components

- `packages/compiler/packages/language-spec` - loses WASM-only output/runtime contracts.
- `packages/compiler/packages/wasm-codegen` - likely gains the WASM output and runtime contract types.
- `packages/compiler/src` - should remain an orchestrator using target-neutral contracts and the WASM backend API.
- runtime and compiler-worker packages - may need import updates for WASM-specific result/runtime types.

## Risks & Considerations

- **Boundary mistakes**: memory layout facts can look WASM-specific because WASM is the first backend. Keep logical layout
  in the source-of-truth package unless a field truly describes emitted WASM.
- **Type churn**: public type imports will move. This is acceptable because the software is unreleased.
- **Naming drift**: when a moved type keeps a WASM-specific name, keep that explicit rather than introducing generic
  aliases too early.

## Related Items

- **Related**: PR #818, which extracted `@8f4e/wasm-codegen`.
- **Related**: `docs/todos/459-extract-compiler-diagnostics-package.md`
- **Related**: `docs/todos/426-decide-compiler-broad-type-splitting-strategy.md`
