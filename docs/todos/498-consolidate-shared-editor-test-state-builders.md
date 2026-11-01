---
title: 'TODO: Consolidate shared editor test-state builders'
priority: Medium
effort: 4-8h
created: 2026-10-14
issue: https://github.com/8f4e/8f4e/issues/1025
status: Open
completed: null
---

# TODO: Consolidate shared editor test-state builders

## Problem Description

Some editor and runtime tests construct partial state literals and cast them to `State` or `unknown as State`.
Those assertions hide missing required fields, so a shared helper can start reading a valid state field and break
an unrelated test at runtime. PR #1018 exposed this in the AudioWorklet routing fixture: its compiler state lacked
`projectMemoryExposuresByGroupPath`, which the shared memory resolver requires.

The repository already provides `createMockState` in `@8f4e/editor-state-testing`, but editor-state maintains a
separate implementation in its internal testing utilities. Both contain full state defaults that can drift apart.

## Proposed Solution

Use `@8f4e/editor-state-testing` as the shared source of complete, type-checked state defaults. Let each test override
the values it needs, and retain editor-state-specific parsing or directive derivation in local helpers that build
on those shared defaults. Migrate full-state fixtures away from assertions that conceal incomplete objects.

Keep the shared testing package independent of the editor-state implementation and its effects. Fix incomplete
test setup rather than adding production fallbacks for fields guaranteed by the state contract.

## Implementation Plan

1. Audit full-state fixtures in editor-state, web-ui, editor-core environment plugins, and browser runtime packages.
   Start with AudioWorklet and WebWorker runtime tests that use partial literals asserted as `State`.
2. Consolidate full state defaults in the existing testing package. Preserve typed nested overrides and fresh mutable
   objects for each invocation; remove duplicated default-state construction from internal helpers.
3. Migrate affected tests to the shared builder and add test-only dependencies where needed. Keep genuinely narrow
   fixtures typed against their narrow contracts rather than asserting them as complete state.
4. Preserve realistic ownership and identity: project blocks belong to the root tree, and the rendered block list
   points to the active slice. Set up compiled declarations, exposures, and callbacks explicitly where relevant.
5. Document the shared builder and override pattern, and cover default completeness, override behavior, and isolation
   between fixture instances in the helper package's tests.

## Success Criteria

- [ ] Full editor state defaults have one shared implementation checked against `State` without a completeness cast.
- [ ] Migrated editor/runtime tests use the shared builder instead of incomplete literals asserted as `State`.
- [ ] Required compiler metadata, including exposure tables and memory plans, is present in default fixtures.
- [ ] Editor-state-specific parsing and directive setup remain available without duplicating full state defaults.
- [ ] Nested overrides preserve unrelated defaults, and fixtures do not share mutable state across tests.
- [ ] Project ownership and block-array identity remain correct in tests that depend on them.
- [ ] Production code gains no compatibility handling for incomplete test fixtures.
- [ ] Affected tests and typechecks pass, and the documented testing pattern matches the final implementation.

## Affected Components

- `packages/editor/packages/editor-core/packages/editor-state-testing/src/index.ts` and its tests/README.
- `packages/editor/packages/editor-core/packages/editor-state/src/pureHelpers/testingUtils/testUtils.ts` and consumers.
- Runtime fixtures in `packages/editor/packages/runtime-audio-worklet/src/runtimeDef.test.ts` and
  `packages/editor/packages/runtime-web-worker/src/runtimeDef.test.ts`.
- Full-state fixtures in web-ui and editor-core environment-plugin tests, plus their test dependency declarations.

## Validation Checkpoints

- Run tests and typechecks for `@8f4e/editor-state-testing`, `@8f4e/editor-state`, `@8f4e/editor-core`, `@8f4e/web-ui`,
  `@8f4e/runtime-audio-worklet`, and `@8f4e/runtime-web-worker` through Nx.
- Run the full affected test set to catch downstream consumers beyond the directly edited packages.
- Confirm the shared testing package still depends on state types rather than the editor-state implementation.

## Related Items

- [PR #1018](https://github.com/8f4e/8f4e/pull/1018) revealed the incomplete AudioWorklet state fixture.
- [TODO 497](archived/497-unify-editor-memory-resolution-for-exposed-aliases.md) introduced shared memory resolution.
