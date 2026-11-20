---
title: 'TODO: Add function paramShape instruction'
priority: Medium
effort: 1-2d
created: 2026-06-08
issue: null
status: Completed
completed: 2026-06-14
---

# TODO: Add Function paramShape Instruction

## Problem Description

Prototype memory shapes let modules reuse related memory declarations through `shape <prototypeId>`. Reusable behavior
should live in functions, but today function signatures must manually duplicate the pointer-shaped interface implied by a
prototype.

For example, a prototype may define module memory:

```8f4e
prototype bar
int a
float b
prototypeEnd
```

A function that operates on that shape should be able to receive pointers to those fields without repeating every
parameter by hand.

## Proposed Solution

Add a function-only instruction:

```8f4e
paramShape bar
```

Inside a function, `paramShape <prototypeId>` expands the prototype memory declarations into pointer parameters. For the
example above, this:

```8f4e
function foo
paramShape bar
push *a
push *b
add
functionEnd float
```

behaves as if the function declared:

```8f4e
function foo
param int* a
param float* b
push *a
push *b
add
functionEnd float
```

Call sites stay explicit and use normal inline call arguments:

```8f4e
module baz
shape bar
call foo &a &b
moduleEnd
```

This keeps prototypes as memory-shape declarations only, and keeps reusable executable behavior in the existing function
system.

## Resolved Decisions

- The working instruction name is `paramShape`. Other possible names were considered, but `paramShape` best signals
  "function params derived from a prototype shape" while staying close to the existing `param` instruction.
- `paramShape` is function-prologue syntax and must appear before executable function body instructions.
- When normal `param` and `paramShape` lines are mixed, source order determines function parameter order if that remains
  straightforward to implement.
- Unsupported pointer-depth expansion should be rejected for now. Add a short code comment at the rejection site that
  explains the current function type system only supports pointer types up to `**`.
- The compiler should not introduce a private/public distinction for prototype fields; all prototype declarations expand.
- Editor rendering should show the effective function params exactly, without extra provenance text.

## Anti-Patterns

- Do not put executable body lines inside prototypes.
- Do not add a `run`/`apply` instruction that expands prototype body code into modules.
- Do not rewrite prototype body memory identifiers into function params; `paramShape` should reuse existing function
  parameter, pointer, call, and stack analysis paths.
- Do not add implicit module-to-function binding. The call site should still pass addresses explicitly.
- Do not introduce compiler-level private/public filtering for prototype declarations.

## Implementation Plan

### Step 1: Add `paramShape` Syntax

- Add `paramShape <prototypeId>` to compiler-spec instruction metadata.
- Restrict placement to function blocks.
- Treat it like function prologue/signature syntax, alongside `param`.
- Reject `paramShape` after executable function body instructions, following the same broad prologue rule as `param`.
- Validate argument shape through the tokenizer's normal instruction argument validation.

### Step 2: Preserve Source AST And Derive Effective Params

- Keep function ASTs source-shaped: `paramShape` remains a `paramShape` line and is not rewritten into synthetic `param`
  lines.
- Preserve the mixed source order of `param` and `paramShape` so call-site parameter order is predictable.
- Ensure signature collection sees the effective expanded parameters before function codegen metadata is finalized.
- Store compiler metadata for each `paramShape` expansion so the editor can render the effective params without parsing
  prototype source or inferring synthetic AST lines.
- Preserve source line metadata so diagnostics point to the `paramShape` line for expansion errors.

### Step 3: Expand Prototype Declarations To Function Params

- Resolve the referenced prototype from the same prototype registry used by `shape`.
- Map each prototype memory declaration to a pointer parameter:
  - `int a` -> `param int* a`
  - `float b` -> `param float* b`
  - `float* input` -> `param float** input`
- Keep declaration order stable enough for call-site argument ordering.
- Expand every prototype declaration; there is no public/private filtering.
- Reject declarations that cannot be represented by the current function type system with a semantic compiler error. Leave a
  short code comment near this rejection explaining that deeper pointer mappings are intentionally unsupported until
  function value types support them.

### Step 4: Integrate With Function Compilation

- Add a `paramShape` instruction compiler that registers expanded params through the same context path as normal `param`
  instructions.
- Let existing pointer local handling make `push *a` work naturally.
- Let existing call inline argument pushes handle `call foo &a &b`.
- Keep the normal function parameter limit checks in force after expansion.

### Step 5: Add Editor Rendering Support

- Add a gap under `paramShape` sized to the number of inherited params.
- Render the compiler-derived effective parameter labels in the gap, for example:

```8f4e
int* a
float* b
```

- Use compiler metadata for the rendered labels rather than parsing the prototype source in editor code.

### Step 6: Add 8f4e Fixture Tests

- Add executable `.test.8f4e` coverage for `paramShape` plus explicit module call arguments.
- Add an error fixture for an unknown prototype.
- Add an error fixture for unsupported pointer-depth expansion.
- Add coverage that normal `param` and `paramShape` ordering is deterministic.

## Success Criteria

- [x] `prototype` remains memory-shape-only.
- [x] `paramShape <prototypeId>` is valid only in functions.
- [x] `paramShape` expands prototype memory declarations into pointer params.
- [x] Function code can dereference expanded params with existing pointer syntax, such as `push *a`.
- [x] Module call sites pass addresses explicitly with normal `call` inline args.
- [x] Editor gaps can display compiler-derived expanded params under `paramShape`.
- [x] Tests use `.test.8f4e` fixtures for executable behavior and compiler diagnostics.

## Affected Components

- `packages/compiler/packages/compiler-spec/src/instructionSpecs.ts` - add `paramShape` instruction metadata.
- `packages/compiler/packages/compiler-spec/src/ast.ts` - represent `paramShape` source lines.
- `packages/compiler/packages/compiler-spec/src/compiled.ts` - expose compiler-derived `paramShape` expansion metadata for consumers.
- `packages/compiler/packages/tokenizer/src/sourceBlockASTBuilder.ts` - preserve `paramShape` source lines in function ASTs.
- `packages/compiler/src/compileSubProgram.ts` - make prototype metadata available during function metadata collection.
- `packages/compiler/src/semantic/buildNamespace.ts` - expand `paramShape` during function metadata collection or shared helper code.
- `packages/compiler/src/compileFunction.ts` - compile expanded params through the normal parameter path.
- `packages/compiler/tests/` - add executable and diagnostic fixtures.
- `packages/editor/packages/editor-state/` - derive `paramShape` gap data from compiler metadata.
- `packages/editor/packages/web-ui/` - render expanded parameter labels over the gap.

## Risks & Considerations

- **Pointer depth**: A prototype pointer field naturally maps to one deeper function pointer type. Current function types
  support up to `**`; unsupported deeper mappings should fail clearly.
- **Parameter limits**: Expanded params count toward the existing function parameter limit.
- **Ordering**: Call-site address order must match expanded parameter order; tests should lock this down.
- **API breakage is acceptable**: The software is unreleased, so internal and external APIs can change directly.

## Related Items

- **Replaces**: `docs/todos/archived/443-add-prototype-body-expansion.md`
- **Related**: `docs/todos/archived/442-add-prototype-memory-shapes.md`
