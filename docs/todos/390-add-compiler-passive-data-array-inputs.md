---
title: 'TODO: Add compiler passive data inputs for array initialization'
priority: Medium
effort: 1-2d
created: 2026-05-04
issue: https://github.com/8f4e/8f4e/issues/652
status: Open
completed: null
---

# TODO: Add compiler passive data inputs for array initialization

## Problem Description

The compiler now uses passive data segments to restore declared initial memory, but every segment is still derived from source-level memory declarations.

The next asset-loading step needs a compiler API that accepts externally supplied passive data payloads and loads them into specific declared arrays. This should let the editor worker keep decoded or generated binary payloads in memory and pass bytecode-ready data back into the compiler during live recompilation, without requiring the compiler package to parse 8f4e project files or decode base64 strings.

## Proposed Solution

Add an optional compiler input for passive data payloads that target arrays by a stable reference, such as module id plus memory id. Each payload should be raw bytes, not base64, so editor-side caching can own decoding and invalidation.

High-level behavior:

- The compiler resolves each target after memory layout is known.
- The target must be a declared array memory item.
- The payload byte length must fit inside the target array allocation.
- The payload is translated into the same initial-memory data segment candidate model used by source defaults.
- Existing zero-fill and segment coalescing behavior should apply unchanged.
- External payloads should be loaded after source-declared defaults so an asset payload can intentionally initialize or replace the array content.

## Anti-Patterns

- Do not add 8f4e source syntax for asset blobs in this step.
- Do not make the compiler parse project files just to discover asset payloads.
- Do not require the compiler to decode base64 when the editor worker can pass raw bytes.
- Do not serialize full zero-filled array images when only a sparse or explicit payload is needed.

## Implementation Plan

### Step 1: Define the API shape

- Add an optional compile argument or compile option for passive data inputs.
- Use a target reference that can be resolved after module memory layout exists.
- Represent payloads as `Uint8Array` or an equivalent byte-oriented type.
- Decide whether the first version needs `byteOffset` inside the target array or only full-array starts.

### Step 2: Translate inputs into segment candidates

- Resolve each target array to its byte address and byte capacity.
- Convert each payload into an initial-memory data segment candidate at the target address plus optional offset.
- Keep this translation near the existing `initialMemoryDataSegments` pipeline so segmentation logic remains centralized.

### Step 3: Preserve initialization semantics

- Keep `initDefaults()` doing one full zero-fill before passive data loads.
- Load source-declared default segments first.
- Load external array payload segments afterward so caller-provided data wins when the same bytes overlap.
- Document the overlay order in the compiler design notes.

### Step 4: Add tests

- Compile a module with an array and an external payload, then verify memory after `initDefaults()`.
- Verify a second `initDefaults()` restores the external payload after memory was dirtied.
- Verify oversized payloads fail with a compiler error.
- Verify payloads cannot target scalar memory items.
- Verify payloads can coexist with source-declared defaults and use the documented overlay order.

## Validation Checkpoints

- `npx nx run @8f4e/compiler:test`
- `npx nx run @8f4e/compiler:typecheck`
- `npx nx run @8f4e/editor-default:typecheck`

## Success Criteria

- [ ] Compiler callers can pass passive data payloads without changing 8f4e source syntax.
- [ ] Payloads can initialize specific declared arrays.
- [ ] Payload bytes participate in passive data segment emission.
- [ ] Re-running exported `initDefaults()` restores both source defaults and external array payloads.
- [ ] Invalid targets and oversized payloads are covered by tests.
- [ ] Compiler design docs explain the API and initialization order.

## Affected Components

- `packages/compiler/src/index.ts` - compile entry point and option plumbing.
- `packages/compiler/src/types.ts` - public compile input type definitions.
- `packages/compiler/src/initialMemoryDataSegments/` - target-to-segment translation and tests.
- `packages/compiler/tests/` - integration tests for memory initialization.
- `packages/compiler/docs/compiler-design.md` - passive data input behavior and overlay order.
- Editor worker/compiler integration - eventual caller-side cache owner for decoded payloads.

## Risks & Considerations

- **Target identity**: The target reference should match existing compiler memory naming rules and avoid introducing a project-file-only concept.
- **Payload ownership**: Raw bytes keep encoding responsibility with the caller, so the compiler should not reinterpret element values unless a later API explicitly asks for typed values.
- **Overlay order**: If payloads overlap source defaults, the winning write order must be intentional and documented.
- **Cache invalidation**: The editor can later pair payloads with caller-owned markers or version numbers; the compiler should not need to recompute hashes for this first version.
- **Segment fragmentation**: External payload segments should use the existing coalescing path instead of inventing separate data emission rules.

## Related Items

- **Related**: `packages/compiler/docs/compiler-design.md`
- **Related**: `packages/compiler/src/initialMemoryDataSegments/`
- **Related**: `docs/todos/305-reuse-wasm-instance-across-incremental-compiles.md`
- **Related**: `docs/todos/094-handle-large-binary-assets-with-opfs.md`

## References

- WebAssembly passive data segments and `memory.init`
- Current compiler passive data memory initialization design

## Notes

- This TODO intentionally tracks an API-level first step. Source-level `data` blocks or project-file asset syntax can be designed later once the compiler accepts caller-provided passive data payloads.
