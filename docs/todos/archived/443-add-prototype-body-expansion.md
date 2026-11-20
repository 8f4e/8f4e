---
title: 'TODO: Add prototype body expansion'
priority: Medium
effort: 1-2d
created: 2026-06-01
issue: null
status: Cancelled
completed: 2026-06-08
---

# TODO: Add Prototype Body Expansion

## Cancellation Note

Cancelled on 2026-06-08. Reusable prototype behavior should be expressed as normal functions instead of executable
prototype bodies. The replacement direction is tracked in
`docs/todos/449-add-function-param-shape.md`: prototypes stay focused on memory shapes, while functions can import a
prototype-shaped pointer parameter list with `paramShape`.

## Problem Description

Prototype memory shapes let modules reuse declarations, but they do not yet let modules reuse the executable behavior that naturally belongs with those declarations.

For example, a reusable mixer prototype may define pointer inputs and an output:

```8f4e
prototype mix
float* a
float* b
float out

push &out
push *a
push *b
add
store
prototypeEnd
```

Today `shape mix` could import `a`, `b`, and `out`, but there is no way for a consuming module to explicitly run the prototype's body between custom pre-code and post-code.

## Proposed Solution

Treat prototype contents as two derived parts:

- Memory shape: every memory declaration line inside the prototype.
- Prototype body: every non-boundary, non-memory-declaration line inside the prototype.

Keep `shape <prototypeId>` as the instruction that imports the memory declarations into the current module. Add a second instruction, with the final name still to decide, that expands the prototype body at the current source location.

Working name:

```8f4e
run mix
```

Example:

```8f4e
module mixAndAttenuate
shape mix

; custom code that runs before the reusable mixer body

run mix

; custom code that runs after the reusable mixer body
push &out
push out
push 2.0
div
store
moduleEnd
```

The `shape mix` instruction should be required before `run mix` in the same module, because the prototype body is expected to depend on the memory declarations inherited from that prototype. Shaping the prototype in one module must not allow running it in another module.

## Naming Notes

The body-expansion keyword is intentionally unresolved.

Candidates:

- `run mix` - short, natural, and does not imply function-call isolation.
- `apply mix` - good if prototypes are framed as reusable behaviors applied to a module.
- `inline mix` - technically precise, but more compiler-flavored.

Avoid:

- `extends` for body execution, because the consuming module needs an explicit insertion point.
- `prototypeBody`, because memory declarations are already syntactically distinguishable from executable body lines.

## Implementation Plan

### Step 1: Extend Prototype Parsing

- Let prototype ASTs collect both `memoryDeclarationLines` and body lines.
- Keep boundary lines (`prototype`, `prototypeEnd`) out of both derived collections.
- Continue validating memory declaration lines for `shape` expansion.

### Step 2: Add Body Expansion Instruction

- Add the chosen body-expansion instruction to compiler-spec metadata.
- Restrict it to module scope.
- Parse its single prototype identifier argument through the tokenizer's normal instruction argument validation.

### Step 3: Track Shaped Prototypes Per Module

- While expanding module sources, record which prototype ids have been imported by `shape`.
- Reject body expansion when the module has not already shaped the referenced prototype.
- Keep the requirement local to the current module.

### Step 4: Expand Prototype Bodies at the Call Site

- Replace the body-expansion instruction with the stored prototype body lines.
- Preserve source metadata so diagnostics point back to the prototype body line while still making it clear which consuming module expanded it.
- Ensure body expansion composes with macro expansion in a deliberate order.

### Step 5: Add 8f4e Fixture Tests

- Add executable `.test.8f4e` fixtures for pre-code, prototype body code, and post-code ordering.
- Add error fixtures for running an unknown prototype and running a prototype body before shaping it.
- Add a fixture proving `shape` in one module does not satisfy `run` in another module.

## Success Criteria

- [ ] A prototype can contain declarations and executable body lines without an extra `prototypeBody` marker.
- [ ] `shape <prototypeId>` imports only memory declarations.
- [ ] The body-expansion instruction expands only executable body lines at its exact location.
- [ ] Body expansion requires `shape <prototypeId>` earlier in the same module.
- [ ] Diagnostics for expanded body lines preserve useful prototype source locations.
- [ ] Tests use proper `.8f4e` fixtures rather than growing API-only fixtures.

## Affected Components

- `packages/compiler-spec/src/instructionSpecs.ts` - add the body-expansion instruction metadata.
- `packages/compiler-spec/src/ast.ts` - represent prototype body lines in `PrototypeAST`.
- `packages/compiler/packages/tokenizer/src/parser.ts` - collect prototype body lines.
- `packages/compiler/src/index.ts` - expand prototype bodies after validating local shape usage.
- `packages/compiler/tests/` - add executable and error fixtures.
- `packages/editor/packages/editor-state/` - expose the new instruction in editor/compiler flows if editor affordances are needed.

## Risks & Considerations

- **Implicit execution confusion**: `shape` should not run prototype body code. Body execution must remain explicit.
- **Ordering ambiguity**: The body-expansion instruction should run exactly where it appears, so pre-code and post-code stay predictable.
- **Source mapping**: Expanded body diagnostics need to remain understandable when the same prototype body is used by multiple modules.
- **No compatibility burden**: The software has not been released yet, so update internal APIs directly and do not add compatibility shims.

## Related Items

- **Related**: `docs/todos/archived/442-add-prototype-memory-shapes.md`
