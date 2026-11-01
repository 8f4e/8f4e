---
title: 'TODO: Keep planned memory and its source together'
priority: Medium
effort: 4-8h
created: 2026-10-14
issue: https://github.com/8f4e/8f4e/issues/1027
status: Open
completed: null
---

# TODO: Keep planned memory and its source together

## Problem Description

Each planned memory module stores layout metadata in `declarations` and effective source declarations in a separate
`declarationSources` array. Their positions must match, but the type contract does not express that relationship.
The module's `memory` lookup returns only the layout record, so consumers must reconstruct its source association.

Group initializer resolution currently finds a resolved backing declaration with `declarations.indexOf(targetMemory)`
and uses that index to retrieve its source. Default resolution also joins the two arrays by index. Reordering,
filtering, or constructing incomplete plans can separate facts that describe the same declaration.

## Proposed Solution

Give each `PlannedMemoryDeclaration` a required `source` containing its effective `MemoryDeclarationLine` and
`isInherited` flag. Extract the existing address, size, and type fields into `MemoryDeclarationLayout`, which low-level
layout helpers can produce before the planner attaches the source.

Keep the ordered `declarations` list and the `memory[id]` lookup pointing to the same complete declaration objects.
Remove the module-level `declarationSources` array and update consumers to read `declaration.source` directly.

Here, source means the effective declaration after shape expansion and layout normalization. Preserve its current
line-number and inheritance semantics; complete original-file or prototype provenance is separate work. Reference
resolution facts, resolved defaults, and pointer provenance remain outputs of their existing compiler passes.

## Pros

- **Reliable pairing:** every planned declaration carries its source, so the relationship no longer depends on two
  arrays staying synchronized.
- **Direct source access:** resolving an exposed alias also provides its backing declaration's source, eliminating
  the additional linear search in group initializer validation.
- **Simpler default resolution:** each iteration has the layout, effective source line, and inheritance flag together.
- **Clearer contracts:** layout-only helpers use layout metadata, while consumers of complete planned declarations
  can rely on source information being present.
- **Safer maintenance:** declaration reordering and test-fixture construction cannot silently omit or misalign a
  separate source entry. Shared records also avoid copying source data into each lookup representation.

## Implementation Plan

1. Split layout metadata from complete planned declarations in `@8f4e/language-spec`; require source information on
   the complete record. Update layout primitives to return the layout contract where appropriate.
2. Attach effective source information when the memory planner creates each declaration. Preserve declaration
   ordering, addresses, and object identity between the ordered list and the lookup; remove `declarationSources`.
3. Update memory-reference and default resolvers to consume the attached source. Remove the initializer's positional
   source lookup and other joins between declaration and source arrays.
4. Update shared consumers, exports, documentation, snapshots, and test builders to use the appropriate contract.
   Complete-plan fixtures must supply real source records; layout-only fixtures should use the narrower layout type.
5. Add focused coverage for inherited declarations, scalar versus single-element array initializers, and aliases
   exposed through nested groups. Verify that cached ASTs and effective source lines are not mutated by later passes.

## Success Criteria

- [ ] Every planned declaration has a required effective source line and inheritance flag.
- [ ] `memory[id]` and `declarations` reference the same complete declaration objects.
- [ ] The module-level `declarationSources` array and positional source-recovery logic are removed.
- [ ] Layout helpers can operate without requiring source metadata.
- [ ] Inherited shapes, declaration ordering, memory addresses, initializer precedence, and diagnostics retain their behavior.
- [ ] Scalar declarations and single-element arrays remain distinguishable during initializer validation.
- [ ] Later passes preserve source records and cached ASTs while producing their own resolution results.
- [ ] Consumers and fixtures use the new contracts directly without optional-source fallbacks or compatibility aliases.

## Affected Components

- `packages/compiler/packages/language-spec/src/memory.ts`, shared exports, and layout metadata helpers.
- `packages/compiler/packages/sub-program/packages/memory-planner/src/` and layout primitives.
- `packages/compiler/packages/sub-program/packages/memory-reference-resolver/src/`, including group initializers.
- `packages/compiler/packages/sub-program/packages/memory-default-resolver/src/`.
- Compiler, WebAssembly codegen, and editor consumers or fixtures that construct or inspect memory plans.

## Risks & Considerations

- Preserve ordered declaration access used by numeric memory references such as `&module:0`.
- Preserve effective source locations for inherited shapes; attaching source must not imply richer origin tracking.
- Keep phase-specific resolution reports separate instead of accumulating mutable semantic results in the plan.
- Update required-field fixtures rather than weakening the production contract to accommodate incomplete test data.
- The project is unreleased: remove obsolete fields and update consumers directly without compatibility fallbacks.
- This task changes the compiler's data model, without adding language syntax or changing group scope rules.

## Validation Checkpoints

- Run language-spec, memory-planner, memory-reference-resolver, memory-default-resolver, and compiler tests through Nx.
- Run affected editor and WebAssembly codegen tests where shared plan consumers or fixtures change.
- Run affected Nx typechecks and Biome on changed TypeScript files.
- Confirm declaration/source pairing, shared object identity, unchanged layout, and source immutability in focused tests.

## Related Items

- [PR #1019](https://github.com/8f4e/8f4e/pull/1019) introduced group initializers, exposing the positional
  lookup needed to recover a resolved declaration's source.
- [TODO 499](499-unify-project-instruction-syntax-parsing.md) separately addresses project instruction syntax ownership.
