---
title: 'TODO: Unify editor memory resolution for exposed aliases'
priority: Medium
effort: 1-2d
created: 2026-10-14
issue: https://github.com/8f4e/8f4e/issues/1017
status: Completed
completed: 2026-10-14
---

# TODO: Unify editor memory resolution for exposed aliases

## Problem Description

Group blocks expose memory from their direct modules under public names. The compiler returns each resolved exposure
in `projectMemoryExposuresByGroupPath`, including its canonical backing module and `targetMemory` declaration. Before
this change, editor input/output connectors consumed that metadata independently, while `resolveMemoryIdentifier` only
looked up declarations in `memoryPlan.modules`. Sliders and other consumers could not resolve exposed aliases.

A slider placed on a group block should be able to control an exposed item without opening the group. Every editor
feature that accepts a compatible memory reference should resolve that alias consistently. Adding separate exposure
lookups to sliders, connectors, and other widgets would duplicate scope and target-resolution rules.

## Implemented Solution

The shared `resolveMemoryTarget` function, exported through `@8f4e/editor-state/memory`, resolves ordinary declarations
and exposed aliases. Its result preserves the public reference while identifying the canonical backing module,
declaration, address, memory index, and storage type. Exposure indexes use weak keys tied to compilation-owned arrays.

`resolveMemoryIdentifier`, input/output connectors, and other memory-reference consumers use that resolver.
Debugger formatting, widget requirements, and connector source-row placement remain in their respective features.
Connector direction uses the backing declaration's pointer type, and runtime reads and writes use its storage type.
Exposures carry no separate public type.

The intended group-block usage is:

```text
8f4e/v1

entry main
group audio
expose gain &voice:level
; @slider &gain 0 1 0.01

module voice
float level 0.5
moduleEnd
groupEnd

module controls
; @slider &audio:gain 0 1 0.01
moduleEnd
entryEnd
```

Both sliders resolve to the same `audio/voice:level` storage. Saving control values to code updates the backing
declaration's default through its canonical owner, including when the control is displayed on a group block.

## Implementation Plan

1. Define a shared resolution context and result that distinguish public alias identity from canonical backing
   ownership. Support group-local aliases, references from enclosing modules, nested groups, and canonical paths.
2. Centralize declaration and exposure lookup using `memoryPlan` and `projectMemoryExposuresByGroupPath`. Any derived
   lookup index must be replaced when compilation metadata or the project changes.
3. Make `resolveMemoryIdentifier` delegate target lookup to the shared resolver while preserving its existing
   address, dereference, indexing, and display-format behavior. Pointer metadata must be read from the canonical owner.
4. Migrate input/output connectors to the same resolver. Remove their independent target lookup while retaining
   source-row matching and deriving connector direction from the backing declaration.
5. Audit all editor memory-reference consumers, including sliders, watches, meters, plots, waves, bars, buttons,
   switches, crossfades, pianos, and configuration bindings. Route target lookups through the shared resolver and
   preserve each consumer's supported argument forms and type requirements.
6. Update control-value saving to find the backing source declaration through the resolved owner. Save slider and
   piano values into their original declarations, preserve exposure lines, and notify the existing project-change flow
   for the blocks actually edited.
7. Add shared resolver tests, focused consumer integration tests, and documentation for controls on group blocks.

## Success Criteria

- [x] Sliders on group blocks resolve local exposed names such as `&gain` and control the backing memory directly.
- [x] References such as `&audio:gain` from the enclosing scope resolve to the same target as the group-local reference.
- [x] Input/output connectors and all compatible editor memory-reference features use the same target-resolution logic.
- [x] No widget or connector maintains its own exposure lookup or alternative group-scope resolution path.
- [x] Resolution preserves the public name alongside canonical backing ownership and memory metadata.
- [x] Nested groups and sibling groups with repeated alias or backing declaration names resolve independently.
- [x] Missing aliases and replacement compilation metadata do not leave controls bound to stale declarations.
- [x] Saving control values updates the correct backing source declaration, including when public and backing names differ.
- [x] Existing direct references, pointer behavior, connector placement/direction, and consumer type restrictions remain covered.
- [x] Editor directive documentation explains group-local and external alias references and saving their values to code.

## Affected Components

- `packages/editor/packages/editor-core/packages/editor-state/src/pureHelpers/resolveMemoryIdentifier.ts` and the shared
  memory-target resolver extracted or introduced beside it.
- `packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/features/connectors/projectMemoryExposures.ts`
  and the input/output connector builders.
- Directive widget resolvers, shared typed-value helpers, and other editor memory-reference consumers.
- `packages/editor/packages/editor-core/packages/editor-state/src/features/code-blocks/features/sliderDefaultSaver/`
  and its menu action, source ownership lookup, and project-change notifications.
- Editor state types and compilation metadata lifecycle where required by the shared result or derived index.
- `packages/editor/packages/editor-core/docs/editor-directives.md` and relevant editor tests.

## Risks & Considerations

- A public alias name can differ from the backing declaration name, and multiple modules can reuse either name.
  Source edits must identify the canonical owner rather than match a memory name in the displayed block.
- Connector classification and runtime access both use the backing declaration's type.
- Alias support does not expand a directive's accepted syntax, supported storage types, or memory-region capabilities.
  Existing float64 slider-write and fractional-range integer-write issues are separate work.
- Keep compiler exposure semantics and source text unchanged. Reuse compiled targets rather than reparsing exposure
  declarations to discover ownership or allocating synthetic memory for aliases.

## Validation Checkpoints

- Run `npx nx run @8f4e/editor-state:test` and `npx nx run @8f4e/editor-core:test`.
- Run affected Nx typechecks; include `@8f4e/web-ui:test` if rendering changes.
- Test shared resolution for direct references, nested/sibling aliases, different public/backing names and storage types,
  unresolved targets, pointer provenance, and metadata replacement.
- Verify slider reads/writes, connector addresses and direction, another read-only widget, another writable control,
  and saving values into the backing declaration through a group alias.
- Manually check group navigation, recompilation, and two controls bound to the same exposed memory.

## Related Items

- [Compiler group memory alias resolution](478-resolve-group-memory-exposures-through-alias-table.md) provides the
  existing compiler contract; this task integrates it throughout the editor.
- [Index editor pointer targets by memory and address](../495-index-editor-pointer-targets-by-memory-and-address.md)
  concerns the same resolver. Coordinate lookup lifecycle and canonical pointer ownership without making that
  performance change a prerequisite.

## Validation Results

- Editor-state, editor-core, and web-ui test suites passed. The shared integration fixture covers nested/sibling aliases,
  inferred backing types, pointer provenance, widget/connector targets, runtime writes, metadata replacement,
  and saving slider and piano values across source owners.
- Editor-state-types, editor-state, editor-core, and web-ui typechecks passed; the editor website production build passed.
- Biome and whitespace checks passed.
- Manual visual verification could not be completed in the in-app browser: both the alias fixture and a basic slider
  fixture displayed a black canvas. Automated interaction and target-resolution checks passed.
