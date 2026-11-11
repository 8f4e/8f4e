---
title: 'TODO: Investigate buffer boundaries for mutable pointers'
priority: Medium
effort: 2-4h
created: 2026-03-26
issue: https://github.com/8f4e/8f4e/issues/451
status: Open
completed: null
---

# TODO: Investigate buffer boundaries for mutable pointers

## Problem Description

Fixed references already expose their target's exclusive logical boundary through `end(*connection)`:

```8f4e
float& connection &source:buffer
push end(*connection)
```

The boundary excludes alignment padding, and an empty buffer ends at its start. This works because a fixed reference
binds one allocated declaration at compile time.

Mutable pointers can be reassigned. Their pointee type describes an element's size, but does not establish the length
or identity of the current allocation. Compiled `end(*pointer)` expressions therefore require a fixed reference.
`end(pointer)` describes the pointer variable's own storage. A caller using a mutable pointer carries the buffer
boundary separately today.

The remaining question is whether mutable pointers should carry enough allocation information to expose a reliable
buffer boundary, and what language and runtime cost that would introduce. Watch's live declaration lookup is a
debugger feature and does not establish a boundary contract for compiled code.

## Design Questions

- Can compile-time provenance prove a boundary throughout the pointer's lifetime, including assignments and calls?
- Would pointers that change allocation need an explicit buffer/range value or an accompanying runtime boundary?
- For a pointer into the middle of a buffer, should the boundary describe the whole allocation or a declared subrange?
- How should unknown addresses and pointers without allocation provenance be represented?
- Can callers pass explicit bounds more clearly and cheaply than extending pointer metadata?

## Investigation Plan

### Step 1: Define supported use cases

Identify cases that fixed references and explicit boundary arguments cannot express conveniently. Include pointer
reassignment, function parameters, and interior pointers.

### Step 2: Compare boundary models

Compare compile-time provenance tracking, explicit buffer/range values, and separate boundary arguments. State which
operations preserve, narrow, or invalidate the available bounds, and assess their runtime and ABI costs.

### Step 3: Record the decision

Choose whether mutable-pointer boundary queries should be implemented. If so, define their contract using exclusive
logical ends and the existing `end()` query syntax before planning compiler or runtime changes.

## Validation Checkpoints

- Compare the proposal with the current fixed-reference behavior in `packages/compiler/docs/prefixes.md`.
- Review pointer provenance work in `docs/todos/431-separate-pointer-type-and-provenance-facts.md`.
- Verify proposed semantics against reassignment, calls, interior pointers, empty buffers, and padded byte buffers.

## Success Criteria

- [ ] The remaining use cases beyond fixed references are documented.
- [ ] Boundary ownership and propagation rules are explicit for each proposed pointer operation.
- [ ] Compile-time guarantees and runtime metadata costs are compared.
- [ ] A decision records whether to extend mutable pointers or keep bounds explicit at call sites.

## Affected Components

- `packages/compiler/packages/language-spec/src/memory.ts` — pointer types and allocation metadata.
- `packages/compiler/packages/sub-program/packages/memory-reference-resolver/` — compile-time boundary resolution.
- `packages/compiler/packages/sub-program/packages/stack-analyzer/` — pointer facts during instruction analysis.
- `packages/compiler/docs/prefixes.md` — documented query semantics.

## Related Items

- `docs/todos/431-separate-pointer-type-and-provenance-facts.md`
- `docs/todos/320-add-pointee-start-address-prefix-for-pointers.md`
