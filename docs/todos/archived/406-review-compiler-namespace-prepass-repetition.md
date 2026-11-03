---
title: 'TODO: Review repeated compiler namespace prepass work'
priority: Medium
effort: 1-2d
created: 2026-05-19
issue: https://github.com/8f4e/8f4e/issues/659
status: Cancelled
completed: 2026-09-07
---

# TODO: Review repeated compiler namespace prepass work

## Problem Description

Compiler coverage hotspots show repeated work in namespace collection and module prepasses. `collectNamespacesFromASTs` performs namespace discovery and layout passes, `prepassNamespace` revisits scalar declarations to set defaults, and `compileModule` runs another `prepassNamespace` before final codegen.

This may be necessary for deferred intermodule layout, but it is currently hard to tell which passes are essential and which can be reused or collapsed.

## Proposed Solution

Review the namespace/prepass pipeline and document why each pass exists. Then reduce repeated semantic normalization and memory declaration processing where possible.

Potential directions:
- Return reusable layout/prepass results from `collectNamespacesFromASTs`.
- Avoid rerunning `prepassNamespace` in `compileModule` when layout data is already known.
- Merge the scalar-default revisit into the main prepass if possible.

## Success Criteria

- [ ] Each namespace/prepass phase has a clear reason or is removed.
- [ ] Intermodule references and deferred layout behavior remain correct.
- [ ] Compiler coverage logs show reduced compiler `rangeExecutions`, especially in `buildNamespace.ts`.

## Affected Components

- `packages/compiler/packages/sub-program/src/semantic/buildNamespace.ts`
- `packages/compiler/src/compiler.ts`
- `packages/compiler/src/index.ts`
