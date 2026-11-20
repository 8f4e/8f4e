---
title: 'TODO: Add pushShape instruction'
priority: Medium
effort: 4-8h
created: 2026-06-08
issue: null
status: Completed
completed: 2026-06-14
---

# TODO: Add pushShape Instruction

## Problem Description

`paramShape <prototypeId>` lets functions consume a prototype-shaped list of pointer parameters, but module call sites
still need to manually push every memory address in the matching order.

For shaped modules this repeats the same prototype interface a second time at every call site:

```8f4e
prototype filterState
float* input
float cutoff
float resonance
float output
prototypeEnd

module filterA
shape filterState
float* input &oscA:output
float cutoff 1200

call runFilter &input &cutoff &resonance &output
moduleEnd

function runFilter
paramShape filterState
functionEnd
```

The function can derive its effective params from the prototype, but callers cannot yet derive the matching address
pushes from the same shape.

## Proposed Solution

Add a module instruction:

```8f4e
pushShape filterState
```

`pushShape <prototypeId>` pushes the addresses of the current module's effective memory items for that prototype onto
the stack, in prototype declaration order.

This allows shaped module call sites to pair naturally with functions that use `paramShape`:

```8f4e
module filterA
shape filterState
float* input &oscA:output
float cutoff 1200

pushShape filterState
call runFilter
moduleEnd

function runFilter
paramShape filterState
functionEnd
```

## Resolved Decisions

- The instruction name is `pushShape`.
- Syntax is `pushShape <prototypeId>`.
- `pushShape` pushes addresses, not values.
- Order follows the referenced prototype's memory declaration order.
- Effective module declarations are resolved by prototype field name against the module's final `memoryMap`.
- Overrides still participate. If a shaped module overrides `float cutoff`, `pushShape` should push the address of the
  override.
- Do not base the pushed list only on `isInherited`, because overridden fields are no longer inherited but are still part
  of the effective shape.
- `pushShape` is module-only.
- Require that the current module declares a matching `shape <prototypeId>` for `pushShape <prototypeId>` to be accepted.
- Because the shape line owns the module/prototype relationship, the implementation should not defensively validate
  that an arbitrary module happens to have every matching memory name.

## Anti-Patterns

- Do not generate or rewrite synthetic `push &name` source lines.
- Do not rewrite source or AST lines to implement the expansion.
- Do not parse module or prototype source in codegen/editor code to discover the address list.
- Do not use `isInherited` as the source of truth for membership in the shape.
- Do not infer an implicit shape when a module has exactly one `shape` line; require the prototype id explicitly.
- Do not add a compatibility path for manual call argument expansion. The manual form already works as normal source.

## Implementation Plan

### Step 1: Add Syntax And Placement

- Add `pushShape <prototypeId>` to compiler-spec instruction metadata.
- Restrict placement to module blocks.
- Validate the single identifier argument through the tokenizer's normal instruction argument validation.

### Step 2: Collect Module Shape Membership Metadata

- Record which prototype ids each module applies through `shape <prototypeId>`.
- Keep this metadata compiler-derived, not editor/source-parser-derived.
- Make it possible for `pushShape` to verify that the current module actually has the requested shape.

### Step 3: Resolve Effective Shape Address List

- Resolve the referenced prototype from the existing prototype registry.
- For each prototype memory declaration, read its field id from the parsed declaration line.
- Resolve that id against the current module's effective `memoryMap`, which already includes shape inheritance and
  overrides.
- Push the resolved declaration address in prototype declaration order.
- Do not add defensive user-facing validation for missing effective fields after the matching module `shape` line has
  been accepted; that would indicate an internal shape expansion invariant failure.

### Step 4: Emit Address Pushes

- Implement `pushShape` codegen by appending the same bytecode shape as explicit `push &field` arguments would produce.
- Preserve normal stack metadata so `call runFilter` sees the same argument stack as the manual address pushes.
- Keep pointer-depth behavior aligned with `paramShape`: every prototype declaration maps to one deeper pointer parameter.

### Step 5: Add Coverage

- Add executable `.test.8f4e` coverage where `pushShape` feeds a function with `paramShape`.
- Add coverage for overridden shape fields to prove overrides are pushed.
- Add an error fixture for an unknown prototype.
- Add an error fixture for using `pushShape` without the module declaring the matching `shape`.
- Add ordering coverage so prototype declaration order defines the call argument order.

## Success Criteria

- [x] `pushShape <prototypeId>` is valid in modules.
- [x] `pushShape` pushes effective module memory addresses in prototype declaration order.
- [x] Overridden shaped fields are included.
- [x] `pushShape` pairs with `paramShape` without manually listing every address at call sites.
- [x] The compiler does not parse source text to derive the pushed address list.
- [x] Tests cover normal calls, overrides, ordering, and diagnostics.

## Affected Components

- `packages/compiler/packages/compiler-spec/src/instructionSpecs.ts` - add `pushShape` instruction metadata.
- `packages/compiler/packages/compiler-spec/src/ast.ts` - represent `pushShape` source lines if a specific type is needed.
- `packages/compiler/src/semantic/` - collect module shape membership and resolve effective shape fields.
- `packages/compiler/src/instructionCompilers/` - emit address pushes for `pushShape`.
- `packages/compiler/tests/` - add executable and diagnostic fixtures.

## Risks & Considerations

- **Override membership**: Shape membership must not be inferred from `isInherited`, because overrides are effective
  shape fields too.
- **Ordering**: The function call ABI depends on stable prototype declaration order.
- **Diagnostics**: Missing fields should point at the `pushShape` line, while unresolved prototype ids should use the
  normal undeclared identifier diagnostic.
- **Multiple shapes**: Explicit prototype ids keep modules with multiple shapes unambiguous.

## Related Items

- **Builds on**: `docs/todos/449-add-function-param-shape.md`
- **Related**: `docs/todos/450-generalize-instruction-placement-config.md`
