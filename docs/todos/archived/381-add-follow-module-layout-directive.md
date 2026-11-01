---
title: 'TODO: Add #follow module layout directive'
priority: Medium
effort: 1-2 days
created: 2026-04-21
issue: https://github.com/8f4e/8f4e/issues/562
status: Cancelled
completed: 2026-06-14
---

# TODO: Add #follow module layout directive

## Problem Description

The compiler currently assigns module memory layout from a dependency-aware but otherwise loose ordering model:

- modules referenced by memory declarations are placed before dependent modules
- independent modules are ordered deterministically by module id
- there is no way to require two modules to be physically adjacent in memory

That makes it impossible to express a source-level guarantee like "module `bar` must be laid out immediately after module `foo` with no module in between". For some layouts, relative ordering alone is not enough; contiguous adjacency is the actual requirement.

## Proposed Solution

Add a module-scoped compiler directive:

```8f4e
module foo
moduleEnd

module bar
#follow foo
moduleEnd
```

Semantics:

- `#follow foo` means the current module must be placed immediately after module `foo` in final memory layout
- no other module may appear between the target and follower
- chained follows such as `c #follow b` and `b #follow a` form a contiguous segment `a -> b -> c`

This should be implemented as a semantic layout constraint, not as an incidental tweak to the current alphabetical module DFS. The ordering algorithm should first build validated follow-chains, collapse them into layout segments, topologically sort those segments against existing memory-declaration dependencies, then expand the segments back into final module order.

Because the software is not released yet, we do not need to preserve internal compiler APIs. Prefer a clean refactor of the module-ordering and directive plumbing over additive compatibility layers.

## Anti-Patterns

- Do not model `#follow` as a soft preference or best-effort hint.
- Do not bolt adjacency checks onto the current per-module DFS without introducing explicit segment/chains as first-class data.
- Do not preserve awkward internal APIs just to avoid updating compiler-owned call sites; we own the codebase and can update usages directly.
- Do not treat ordinary dependency ordering as equivalent to contiguous layout; adjacency is stricter.

## Implementation Plan

### Step 1: Extend directive parsing and metadata flow
- Add tokenizer support for `#follow <identifier>`.
- Treat wrong arity or non-identifier targets as syntax errors.
- Thread the directive through compiler semantic metadata as a module-scoped layout constraint.

### Step 2: Add semantic validation and error surface
- Reject `#follow` outside module blocks.
- Reject self-follow, missing targets, duplicate follow targets, duplicate immediate followers, and follow cycles.
- Add dedicated compiler errors for layout-constraint violations rather than overloading generic errors.

### Step 3: Refactor module ordering around contiguous segments
- Refactor `packages/compiler/src/graphOptimizer.ts` to build follow-chains first.
- Collapse chains into segments and sort segments using existing intermodule memory-declaration dependencies.
- Expand segments back into final module order and keep deterministic placement for unrelated segments.

### Step 4: Update tests and docs
- Add tokenizer, semantic, and graph-ordering coverage for valid chains and invalid configurations.
- Update compiler directive docs and module docs with `#follow` semantics and validation rules.
- Update any internal usage sites or helper assumptions impacted by the refactor.

## Validation Checkpoints

- `rg -n "#follow|followTarget|MODULE_FOLLOW" packages/compiler docs`
- `npx nx run compiler:test`
- `npx nx run compiler:typecheck`

## Success Criteria

- [ ] `#follow <moduleId>` is parsed as a module-scoped compiler directive.
- [ ] The compiler enforces strict immediate adjacency in final memory layout.
- [ ] Chained follow directives form validated contiguous layout segments.
- [ ] Invalid configurations fail with dedicated compiler errors.
- [ ] Compiler docs describe the directive and its constraints.

## Affected Components

- `packages/compiler/packages/tokenizer/src/` - directive parsing and syntax validation
- `packages/compiler/src/semantic/` - directive metadata flow and semantic validation
- `packages/compiler/src/graphOptimizer.ts` - segment-based module ordering refactor
- `packages/compiler/src/compilerError.ts` - dedicated follow/layout error codes
- `packages/compiler/docs/directives.md` - new directive documentation
- `packages/compiler/docs/instructions/blocks/module.md` - module-level usage guidance

## Risks & Considerations

- **Ordering refactor scope**: the clean implementation likely reshapes internal ordering APIs and metadata, but that is acceptable because internal API stability is not a constraint yet.
- **Constraint interaction**: follow-chains must still respect existing dependency ordering from intermodule memory references.
- **Determinism**: unrelated segments still need a clear deterministic ordering rule after the refactor.
- **Error quality**: adjacency conflicts are easy to create accidentally, so diagnostics need to be explicit.

## Related Items

- **Related**: `306` Refactor graphOptimizer to precompute module dependencies
- **Related**: `367` Refactor compiler directive plumbing and loop guard config

## Notes

- This todo intentionally assumes breaking internal compiler refactors are allowed.
- Prefer updating compiler-owned usage sites immediately instead of layering transitional compatibility helpers.
