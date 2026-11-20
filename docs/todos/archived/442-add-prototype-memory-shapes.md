---
title: 'TODO: Add prototype memory shapes'
priority: Medium
effort: 6-12h
created: 2026-06-01
issue: null
status: Completed
completed: 2026-06-01
---

# TODO: Add prototype memory shapes

## Problem Description

8f4e modules can currently reuse executable logic by extracting shared code into functions, but that does not reuse the module's memory shape. When multiple modules need the same set of memory declarations, each module must repeat those declarations by hand.

This makes memory-heavy patterns noisy and brittle:

- repeated declarations can drift across modules
- editor connectors and wires are tied to duplicated source text instead of a named layout concept
- shared logic can be factored out, but the state layout that logic expects cannot be expressed once

The feature should add a reusable, compile-time memory shape mechanism without introducing object-oriented runtime behavior.

## Proposed Solution

Add declaration-only `prototype` blocks and a module-level `shape` instruction that expands a prototype's memory declarations into the consuming module.

Example prototype:

```8f4e
prototype oscillatorState
float phase
float frequency 440
float amplitude 1
prototypeEnd
```

Example use:

```8f4e
module oscA
shape oscillatorState
; executable logic here
moduleEnd
```

The module should compile as if the prototype declarations appeared at the `shape` line:

```8f4e
module oscA
float phase
float frequency 440
float amplitude 1
; executable logic here
moduleEnd
```

Use `shape` rather than `extends` for the consuming instruction. `extends` suggests object-oriented inheritance and behavior reuse, while this feature is intentionally compile-time memory layout reuse.

## Initial Semantics

- Prototype memory is copied per consuming module, not shared between modules.
- `shape <prototypeId>` expands at source order, so declarations before and after it keep predictable layout positions.
- Prototypes are declaration-only in the first version.
- Memory declarations inside prototypes use the same syntax and validation rules as module memory declarations.
- Duplicate memory identifiers in the final expanded module should produce an error.
- Prototype IDs live in their own namespace or in the existing compiled block namespace with clear duplicate-ID diagnostics.
- Prototype expansion must preserve deterministic compile-time addresses and existing live-memory editing behavior.

## Deferred Semantics

These are useful, but should not block the first implementation:

- Multiple `shape` lines in one module.
- Prototypes that include other prototypes.
- Explicit field renaming or namespacing.
- Per-module default-value overrides.
- Editor commands for extracting selected declarations into a prototype.

## Anti-Patterns

- Do not implement this as classical inheritance, dynamic dispatch, or shared runtime state.
- Do not make `shape` a textual preprocessor feature that bypasses AST validation.
- Do not silently allow duplicate memory names between expanded prototype declarations and local module declarations.
- Do not require copied source text in modules just so the editor can render connectors.
- Do not hide generated memory from the compiled memory map; editor and runtime tooling still need normal memory metadata.

## Implementation Plan

### Step 1: Add source block vocabulary

- Add `prototype` / `prototypeEnd` as a document/compiler source block type.
- Update tokenizer block detection and project parsing so prototype blocks can be stored alongside modules, functions, constants, and macros.
- Add prototype blocks to the compile input shape.
- Add parser tests for valid prototype blocks and mismatched block markers.

### Step 2: Parse and validate prototype contents

- Reuse existing memory declaration parsing for prototype lines.
- Reject non-declaration executable instructions inside prototype blocks.
- Decide whether compiler directives are allowed in prototypes; default to disallowing them until a concrete use case exists.
- Add diagnostics for duplicate prototype IDs and invalid prototype contents.

### Step 3: Add `shape` expansion

- Add `shape <prototypeId>` as a module-level semantic instruction or pre-layout AST instruction.
- Resolve prototype IDs before namespace discovery and module layout.
- Materialize prototype memory declarations into modules at the `shape` line before existing layout code runs.
- Preserve source location metadata so errors on expanded declarations can point back to the prototype and/or consuming `shape` line.

### Step 4: Preserve compiler layout behavior

- Ensure expanded declarations participate in the normal namespace discovery and layout passes.
- Confirm defaults, array sizes, pointer types, regions, and intermodule references behave like ordinary module declarations.
- Ensure module memory maps expose expanded fields exactly like local fields so existing editor and runtime code can consume them.

### Step 5: Render prototype-derived memory in the editor

- In module blocks, render prototype-derived declarations as virtual memory rows near the `shape` line.
- Mark the rows as coming from the prototype without changing connector IDs or compiled memory IDs.
- Keep connectors and wires working against the real compiled module memory map.
- Consider a collapsed/expanded UI affordance once large prototypes exist.

### Step 6: Add integration tests and examples

- Add compiler tests showing two modules using the same prototype get separate memory addresses.
- Add tests for source-order layout around `shape`.
- Add duplicate-memory-name tests.
- Add tokenizer/project tests for prototype block collection.
- Add a small example project that uses a prototype for repeated module state.

## Validation Checkpoints

- `npx nx run @8f4e/tokenizer:test`
- `npx nx run @8f4e/compiler:test`
- `npx nx run @8f4e/editor-state:test`
- `npx nx run-many --target=typecheck --all`

## Success Criteria

- [ ] Users can define a `prototype` block containing memory declarations.
- [ ] Modules can consume a prototype with `shape <prototypeId>`.
- [ ] Consuming modules get their own memory allocation for prototype fields.
- [ ] Prototype fields appear in compiled module memory maps.
- [ ] The editor can render prototype-derived memory rows and use them for connectors/wires.
- [ ] Duplicate field names and unknown prototypes produce clear diagnostics.
- [ ] Existing module/function/constants behavior remains unchanged.

## Affected Components

- `packages/compiler-spec/src/instructions.ts` - source block vocabulary and instruction names.
- `packages/compiler/packages/tokenizer/src/project.ts` - project block parsing and compile input grouping.
- `packages/compiler/packages/tokenizer/src/syntax/getBlockType.ts` - block type detection.
- `packages/compiler/src/compiler.ts` - compile input handling and module compilation.
- `packages/compiler/src/semantic/buildNamespace.ts` - namespace discovery and layout after expansion.
- `packages/editor/packages/editor-state/src/features/code-blocks/` - block typing, rendering, and virtual memory rows.

## Risks & Considerations

- **Source mapping**: expanded declarations need useful diagnostics without making errors feel detached from user-written code.
- **Editor expectations**: generated rows must behave like ordinary memory rows for connectors while still making their prototype origin visible.
- **Namespace design**: prototype IDs should not create accidental collisions with modules, constants, or functions unless that is an intentional language rule.
- **Future extension pressure**: overrides, nested prototypes, and multiple shapes are attractive, but the first version should stay declaration-only and deterministic.
- **Internal API compatibility**: the software has not been released yet, so it is acceptable to break internal APIs when that produces a cleaner implementation.

## Notes

- This is better described as memory shape reuse than module inheritance.
- `shape` is the preferred consuming instruction name because it names the memory-layout concept directly.
- Keep the implementation close to existing AST and namespace layout paths so deterministic allocation and live memory editing continue to work normally.
