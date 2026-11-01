---
title: 'TODO: Replace serialized function type registry keys'
priority: Medium
effort: 2-4h
created: 2026-05-25
issue: https://github.com/8f4e/8f4e/issues/688
status: Done
completed: 2026-05-25
---

# TODO: Replace serialized function type registry keys

## Problem Description

The function type registry currently deduplicates WebAssembly function signatures by creating a string key with `JSON.stringify({ params, results })` in `packages/compiler/src/instructionCompilers/functionEnd.ts`.

That works because JavaScript `Map` keys compare arrays and objects by identity rather than by structural value, but it is a poor internal contract for compiler-owned type identity. It serializes structured type data just to recover stable equality, and it makes the registry shape look looser than it really is.

The broader compiler hardening goal is to use strict internal types where applicable instead of handling ambiguity during runtime. Function type signatures are structured compiler data, so the registry should express that structure directly instead of encoding it through JSON serialization.

## Project Compatibility Note

This project has not been released yet and we own the whole codebase. Do not add compatibility layers, legacy aliases, adapter shims, or fallback paths just to preserve broad internal interfaces. Prefer changing the type contracts directly and updating all call sites in the repo.

## Proposed Solution

Replace the serialized string key with an explicit typed function signature identity mechanism.

Possible approaches:

- Add a small `FunctionTypeKey` type and helper that encodes `params` and `results` without generic JSON serialization.
- Store typed signature records in `FunctionTypeRegistry` and use a structural equality helper to find an existing type index.
- Introduce a small registry API such as `getOrRegisterFunctionType(registry, signature)` so call sites do not manipulate `signatureMap` directly.

Prefer the approach that removes ad hoc serialization while keeping the registry simple and local to compiler internals.

## Implementation Plan

### Step 1: Centralize Type Registration

- [x] Add a helper for registering or looking up a function type.
- [x] Replace the current key creation and `signatureMap` manipulation with that helper.
- [x] Keep `functionEnd` as the single registration point for user function signatures.

### Step 2: Replace JSON Serialization

- [x] Replace `JSON.stringify({ params, results })` with a typed key/equality strategy.
- [x] Update `FunctionTypeRegistry` in `packages/compiler-spec/src/compiled.ts` if its shape needs to change.
- [x] Avoid broadening types or adding runtime fallback checks just to preserve the existing map shape.

### Step 3: Keep Final Assembly Simple

- [x] Preserve the current direction where `functionEnd` stores the registered `typeIndex` on function compilation state.
- [x] Do not reintroduce a second signature serialization or registry lookup in `compileFunction`.

## Validation Checkpoints

- Run `npx nx run compiler-spec:typecheck`.
- Run `npx nx run compiler:typecheck`.
- Run `npx nx run compiler:test`.
- Check `rg -n "JSON.stringify\\(\\{ params, results \\}\\)|signatureMap\\.get\\(signature\\)" packages/compiler/src packages/compiler-spec/src`.

## Success Criteria

- [x] Function type registry deduplication no longer relies on `JSON.stringify({ params, results })`.
- [x] Function type identity is represented by typed compiler data or a dedicated registry helper.
- [x] `functionEnd` remains the single registration point for function type indices.
- [x] `compileFunction` continues to consume the registered `currentFunctionTypeIndex` directly.
- [x] Compiler tests and typechecks pass.

## Completion Notes

Completed in PR followup branch `ai/replace-function-type-registry-keys`.

- `FunctionTypeRegistry` now stores typed registered signatures instead of `signatureMap`.
- `functionEnd` delegates lookup/registration to `getOrRegisterFunctionType`.
- Matching param/result Wasm type arrays share one type index through structural equality.
- No compatibility layer was kept for the removed serialized key contract.

## Affected Components

- `packages/compiler-spec/src/compiled.ts`
- `packages/compiler/src/instructionCompilers/functionEnd.ts`
- `packages/compiler/src/compiler.ts`
- function type registry tests or function-end compiler tests

## Risks & Considerations

- **Ownership boundary**: `FunctionTypeRegistry` lives in `compiler-spec`; if changing it affects downstream packages in this repo, update those consumers directly instead of keeping `signatureMap` as a compatibility layer.
- **Overengineering risk**: Avoid a large registry abstraction if a small typed helper is enough.
- **Wrong-goal risk**: Do not replace JSON serialization with another opaque string format unless it is clearly modeled as a typed key. The goal is to make signature identity explicit, not merely prettier.
- **Regression risk**: Function signatures with the same param/result types must still share one Wasm type entry and type index.

## Related Items

- **Follows**: `413-split-compiled-function-lifecycle-types.md`
- **Follows**: `414-split-compiler-context-phase-types.md`
