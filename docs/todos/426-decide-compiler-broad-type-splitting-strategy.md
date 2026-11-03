---
title: 'TODO: Decide compiler broad type splitting strategy'
priority: Medium
effort: 2-4h
created: 2026-05-26
issue: https://github.com/8f4e/8f4e/issues/714
status: Open
completed: null
---

# TODO: Decide compiler broad type splitting strategy

## Problem Description

Several language-spec contracts still act as broad "swiss army" shapes that combine multiple semantic variants behind optional fields. A quick attempt to split some apparently small cases showed that even those changes cascade across stack analysis, codegen, semantic normalization, and snapshots.

Known candidates:

- `StackItem` - tracked separately in `425`; combines plain values, addresses, pointee facts, and numeric facts.
- `DataStructure` - combines scalar vs array, pointer vs non-pointer, storage kind, layout, defaults, and pointee metadata.
- `LocalBinding` - combines numeric locals and pointer locals, then codegen mutates optional pointee region fields.
- `CompilationContext` - combines module, function, namespace-prepass, stack-analysis, block-state, directive, and codegen state.
- `MapBlockState` / `MapRow` - uses boolean type facts and a `defaultSet` flag paired with optional default fields.
- `CollectedNamespace` - represents both constants namespaces and laid-out module namespaces using optional module-only fields.
- `Const` / `NormalizedArgumentLiteral` - can be plain numeric values or address-bearing values.

These shapes make call sites recover invariants with optional chaining, boolean combinations, non-null assertions, and ad hoc checks. The risk is not only type looseness; the same semantic concepts are represented slightly differently at different phases.

## Proposed Solution

Do a short design pass before implementation. The output should be a migration decision document or a set of smaller TODOs that answer:

- Which broad types should be split first?
- Which types should share a common value/address/pointee representation?
- Which splits are worth doing now, and which should wait until `StackItem` is narrowed?
- Which changes can be done independently without touching most of the compiler?
- Where compatibility aliases or temporary bridge helpers are intentionally not needed because the project is unreleased?

Prefer a staged plan over one large refactor. The likely order is:

1. Finish `StackItem` / `LocalBinding` value-address-pointee modeling together.
2. Decide whether `DataStructure` should split by declaration form, pointer-ness, default shape, or a nested metadata model.
3. Handle small dependent state shapes such as `MapBlockState` and `CollectedNamespace` only when their surrounding consumers are ready.
4. Revisit `CompilationContext` last, because it is a phase/state ownership problem more than a simple discriminated union.

## Anti-Patterns

- Do not start by changing several shared language-spec contracts at once.
- Do not treat `MapBlockState` or `CollectedNamespace` as isolated "tiny" refactors without checking stack analysis, snapshots, and semantic normalization.
- Do not add a discriminant while leaving the old optional-field model active indefinitely.
- Do not introduce compatibility aliases for old shapes unless a temporary migration helper is essential inside one commit.
- Do not replace optional chaining with broad casts; the point is to make the invariant explicit.

## Implementation Plan

### Step 1: Inventory Current Shapes

- Review the candidate types and list their variants, required fields, optional fields, producers, and consumers.
- Record which optional fields are genuinely optional API output versus variant-specific internal state.
- Identify which types share concepts that should use the same model, especially value kind, address metadata, and pointee metadata.

### Step 2: Choose Migration Boundaries

- Decide whether `StackItem`, `LocalBinding`, and address-bearing constants should share constructors or metadata helpers.
- Decide whether `DataStructure` should split into scalar/array/pointer variants or keep one top-level shape with stricter nested fields.
- Decide whether `MapBlockState` and `CollectedNamespace` should be handled after the larger shared concepts or as separate small tickets.

### Step 3: Break Into Concrete TODOs

- Create or update focused TODO files for the chosen migration steps.
- Include expected search patterns, affected files, and validation commands for each step.
- Keep each TODO narrow enough to typecheck and test independently.

## Validation Checkpoints

- `rg -n "interface (DataStructure|LocalBinding|CompilationContext|MapBlockState|CollectedNamespace)|type Const|NormalizedArgumentLiteral|interface StackItem" packages/compiler/packages/language-spec/src -g '*.ts'`
- `rg -n "\\?\\.|!|pointeeBaseType|isPointingToPointer|defaultSet|defaultIs|memory\\?\\[|byteAddress\\?|wordAlignedSize\\?" packages/compiler/src packages/compiler/packages/language-spec/src -g '*.ts'`
- Confirm the resulting plan does not require editing unrelated editor/runtime packages unless the shared language-spec contract truly crosses that boundary.

## Success Criteria

- [ ] Each broad candidate type has an explicit decision: split now, split later, nest metadata, or leave as-is.
- [ ] The migration order is documented and avoids broad simultaneous type churn.
- [ ] Follow-up TODOs exist for implementation steps that are larger than this design pass.
- [ ] The plan explains how it relates to `425-split-stack-item-value-and-address.md`.

## Affected Components

- `packages/compiler/packages/language-spec/src/semantic.ts` - shared semantic contracts for stack, locals, context, maps, namespaces, and constants.
- `packages/compiler/packages/language-spec/src/memory.ts` - `DataStructure` and memory value/default metadata.
- `packages/compiler/src/stackAnalysis/` - stack item production, consumption, and map validation.
- `packages/compiler/src/semantic/` - namespace collection, compile-time argument normalization, and memory declaration metadata.
- `packages/compiler/src/instructionCompilers/` - codegen consumers that currently rely on broad metadata shapes.

## Risks & Considerations

- **Cascade risk**: Apparently small shape changes can update snapshots, analysis, codegen, and semantic normalization at the same time.
- **Ordering matters**: Splitting dependent types before `StackItem` may cause churn that is later rewritten.
- **Public contract churn**: These types live in `language-spec`, so editor-state or tooling consumers may need follow-up changes.
- **No release compatibility burden**: Prefer direct updates over compatibility aliases because the project has not been released yet.

## Related Items

- **Related**: `docs/todos/425-split-stack-item-value-and-address.md`
- **Related**: `docs/todos/424-rename-layout-words-to-allocation-units.md`
- **Related**: `docs/todos/414-split-compiler-context-phase-types.md`
- **Related**: `docs/todos/415-discriminate-compiler-block-stack-frames.md`

## Notes

- This was created after an attempted "small" split of `MapBlockState` and `CollectedNamespace` proved wider than expected. The next move should be choosing the right migration boundaries, not pushing a partial type rewrite.
