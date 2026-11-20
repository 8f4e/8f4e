---
title: 'TODO: Pass constant namespaces into groups'
priority: Medium
effort: 1-2d
created: 2026-08-27
issue: null
status: Completed
completed: 2026-08-27
---

# TODO: Pass Constant Namespaces Into Groups

## Problem Description

Constants are already organized into named `constants` blocks and imported by compiler blocks with `use`. Nested
project groups need an explicit way to make one of those parent-owned namespaces available under the child's qualified
namespace without copying values, automatically importing constants, or searching ancestors.

## Implemented Contract

```8f4e
constants env
const SAMPLE_RATE 48000
constantsEnd

entry main
group synth
pass env

module oscillator
use env
int sampleRate SAMPLE_RATE
moduleEnd
groupEnd
entryEnd
```

- `pass env` makes the immediate parent's `constants env` namespace available to the child under the same local name.
- `pass` forwards a namespace, not an individual constant value.
- Each consuming module, function, prototype, or constants block still explicitly imports the namespace with `use env`.
- A nested group must repeat `pass env` at every parent-to-child boundary.
- A root-level `pass env` is syntactically accepted and reports that the parent namespace is undefined.
- Project/group scope no longer supports unwrapped `const` declarations; constants have one representation: named
  `constants` blocks.
- `pass` creates no runtime state and emits no WebAssembly.

The composer records each pass with its canonical group and parent paths. Constant resolution turns those declarations
into qualified aliases such as `synth/env -> env` and `synth/voices/env -> synth/env`. Existing qualified `use`
instructions then resolve through the alias table. The resolved namespace is shared rather than copied or injected into
AST blocks.

## Constraints

- Resolve only against the immediate parent scope.
- Accept only constants-block namespaces as pass targets; module constant environments are not group interfaces.
- Reject missing parent namespaces and local namespace collisions at the `pass` source line.
- Do not auto-import a passed namespace into child blocks.
- Do not search ancestors or add compatibility fallback lookup.
- Do not rewrite AST arguments or fabricate `const`/`use` lines.
- Recompute semantic constant facts when a parent constants block changes even if child ASTs are served from cache.

## Validation Checkpoints

- `npx nx run @8f4e/language-spec:test`
- `npx nx run @8f4e/tokenizer:test`
- `npx nx run @8f4e/project-preparser:test`
- `npx nx run @8f4e/program-composer:test`
- `npx nx run @8f4e/constant-resolver:test`
- `npx nx run @8f4e/compiler:test`
- `npx nx run @8f4e/editor-state:test`
- `npx nx run-many --target=typecheck --all`

## Success Criteria

- [x] A group can forward one same-named constants namespace from its immediate parent with `pass NAME`.
- [x] Consumers explicitly opt into passed namespaces with the existing `use NAME` instruction.
- [x] Nested forwarding requires one visible `pass` at every boundary.
- [x] Root and missing-parent passes produce source-contextual semantic diagnostics.
- [x] Module namespaces cannot be used as group constant interfaces.
- [x] Parent constants-block changes are reflected when cached child ASTs are reused.
- [x] Project text and editor round trips preserve namespace pass declarations.
- [x] No AST arguments are rewritten and no synthetic source lines are injected.

## Affected Components

- `packages/compiler/packages/language-spec` - project namespace pass contracts and instruction placement.
- `packages/compiler/packages/sub-program/packages/tokenizer` - syntax parsing for project `pass` lines.
- `packages/compiler/packages/project-preparser` - project/group source preservation.
- `packages/compiler/packages/program-composer` - canonical group ownership for namespace passes.
- `packages/compiler/packages/sub-program/packages/constant-resolver` - qualified namespace alias resolution.
- `packages/compiler/packages/sub-program` - source-contextual error mapping.
- `packages/editor/packages/editor-state` - editing and serialization of project-scope pass lines.

## Related Items

- **Related**: `docs/todos/archived/477-establish-project-object-model.md`
- **Related**: `docs/todos/archived/478-resolve-group-memory-exposures-through-alias-table.md`
- **Related**: `docs/todos/archived/460-fix-cross-block-constant-cache-dependencies.md`
