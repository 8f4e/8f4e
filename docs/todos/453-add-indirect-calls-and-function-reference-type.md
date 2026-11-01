---
title: 'TODO: Add indirect calls and function reference type'
priority: Medium
effort: 2-4d
created: 2026-06-11
issue: https://github.com/8f4e/8f4e/issues/947
status: Open
completed: null
---

# TODO: Add Indirect Calls And Function Reference Type

## Problem Description

8f4e can call known functions directly, but it has no source-level way to treat functions as values. This prevents users
from building dispatch tables, callback slots, state-machine jump tables, or runtime-selected behavior without encoding
large conditional call chains.

WebAssembly does not allow arbitrary function pointers to be manufactured from linear-memory bytes. Indirect calls must
go through a table: code loads an integer table index, `call_indirect` checks the expected function signature, and the
runtime calls the table entry if the index and type are valid. 8f4e should expose that model deliberately instead of
pretending function references are raw memory addresses.

## Proposed Solution

Add a first-class function reference value type to 8f4e and use it as the source-level representation for WebAssembly
table indices.

The design should support:

- declaring or deriving function references for concrete 8f4e functions
- storing function-reference table indices in memory when users need runtime dispatch
- loading a function reference from memory or locals
- calling a function reference through a checked indirect-call instruction
- preserving function signature metadata so indirect calls can validate arguments before emitting `call_indirect`

The implementation should keep the WebAssembly table as the authoritative callable storage. Linear memory may store
typed table indices, but raw integers should not automatically become callable without function-reference metadata.

## Anti-Patterns

- Do not model function references as arbitrary byte addresses in linear memory.
- Do not allow `push 7` followed by an indirect call to silently target table slot `7` without type metadata.
- Do not bypass WebAssembly's `call_indirect` type check or assume all function signatures share one table type.
- Do not add dynamic dispatch by emitting long compiler-generated chains of direct calls when a table call is the real
  target behavior.

## Implementation Plan

### Step 1: Define the function reference type

- Add a function reference type to language-spec value/type metadata.
- Decide its source syntax, such as a `funcref` scalar type or a signature-aware spelling like `fn<int,float>`.
- Encode the referenced function signature in compiler metadata so stack analysis can validate indirect call arguments.
- Decide whether function references are initially limited to concrete non-overloaded function ids or can refer to
  resolved overloads.

### Step 2: Build table metadata during function collection

- Assign table indices to functions that can be referenced indirectly.
- Preserve the mapping from source function identity to Wasm table index.
- Keep table-index assignment deterministic across builds.
- Ensure pruned functions that remain reachable only through function references are retained by the reachability pass.

### Step 3: Add reference creation and storage paths

- Add syntax for taking a function reference, such as `&functionName` or a dedicated instruction.
- Allow storing typed function references in memory and locals.
- Keep memory representation as an integer table index while preserving type metadata in stack, local, and memory
  declarations.
- Reject untyped integer-to-function-reference conversion until there is an explicit checked cast design.

### Step 4: Add indirect call instruction support

- Add an instruction for calling a function reference, such as `callRef`, that consumes arguments and a typed function
  reference from the stack.
- Emit WebAssembly `call_indirect` with the expected function type index and table index operand.
- Validate argument count and value types during stack analysis before codegen.
- Surface clear diagnostics for missing function-reference metadata, signature mismatches, and invalid call placement.

### Step 5: Add tests and documentation

- Add compiler tests for table index assignment, function-reference creation, storage/load, and indirect calls.
- Add negative tests for raw integer calls, signature mismatches, missing references, and pruned indirectly referenced
  functions.
- Add example `.8f4e` programs showing a callback slot and a small dispatch table.
- Document the distinction between table indices and raw linear-memory function pointers.

## Success Criteria

- [ ] 8f4e has a first-class function reference type with signature metadata.
- [ ] Users can store and load function references without treating them as arbitrary memory addresses.
- [ ] Indirect calls lower to WebAssembly `call_indirect`.
- [ ] Stack analysis validates indirect call argument and return types.
- [ ] Functions reachable through function references are not incorrectly pruned.
- [ ] Tests cover valid indirect dispatch and invalid raw-integer/function-signature cases.

## Affected Components

- `packages/compiler/packages/language-spec/src/` - value type, function metadata, and compiled output contracts.
- `packages/compiler/src/semantic/` - function reference parsing, resolution, and reachability metadata.
- `packages/compiler/src/stackAnalysis/` - function-reference stack metadata and indirect-call validation.
- `packages/compiler/src/instructionCompilers/` - `call_indirect` bytecode emission.
- `packages/compiler/packages/wasm-codegen/packages/wasm-utils/src/` - table and element-section helpers, if table emission
  needs shared utils.
- `packages/compiler/docs/` - user-facing function reference and indirect-call documentation.

## Risks & Considerations

- **Type design**: a plain `funcref` may be too broad for useful compile-time validation; signature-aware metadata is likely
  required even if the source syntax stays compact.
- **Overloads**: overloaded source names must resolve to a concrete function signature before a reference can be taken.
- **Reachability**: function pruning must account for references stored in memory or tables, not just direct calls.
- **Runtime compatibility**: table and element-section emission should be checked against the browser and native runtime
  targets supported by the project.
- **Future reference types**: WebAssembly reference-types support may eventually allow richer `funcref` handling, but the
  initial implementation can target MVP-style tables and `call_indirect`.

## Related Items

- **Related**: `docs/todos/435-add-polymorphic-function-overloads.md`
- **Related**: `docs/todos/452-add-reachability-based-function-pruning.md`
- **Related**: `docs/todos/449-add-function-param-shape.md`
- **Related**: `docs/todos/451-add-push-shape-instruction.md`

## Notes

- This TODO intentionally frames function references as typed table indices, not raw pointers. That matches WebAssembly's
  execution model while still allowing memory-backed dispatch tables in 8f4e source.
