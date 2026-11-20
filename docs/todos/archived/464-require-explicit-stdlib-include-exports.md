---
title: 'TODO: Require explicit stdlib include exports'
priority: Medium
effort: 1-2d
created: 2026-06-19
issue: null
status: Completed
completed: 2026-06-19
---

# TODO: Require Explicit Stdlib Include Exports

## Problem Description

Standard-library include files currently expand into every function block they contain. Include resolution derives
private function sources that the compiler combines with the canonical project's function collection.

That works while each include file is effectively one public function family, but it blocks a useful stdlib shape:

- one or more public entry/helper functions exposed by the include;
- private helper functions in the same stdlib file;
- public functions calling private helpers without leaking those helper names into the project-global function namespace.

Because compiler function names are global, unprefixed helper functions can collide with user functions or helpers from
other include files. The current include behavior also has no way to distinguish public include symbols from
implementation details.

The project has not been released, so this can be implemented as a clean breaking change. Do not preserve compatibility
with unmarked include files.

## Proposed Solution

Use `#export` inside included source files as an include-local public-symbol marker.

The meaning of `#export` should be context-sensitive at the project-preparser boundary:

- In normal project function blocks, `#export` keeps its existing meaning: export the function from the final WebAssembly
  module.
- In include source files, `#export` means: expose this function from the include into the project function namespace.

During include expansion, the preparser should consume include-local `#export` lines and replace them with empty lines
before compiler input is created. Replacing instead of deleting preserves block-relative line numbers for diagnostics.
Like normal function exports, include-local `#export` may optionally provide an alias. A bare `#export` exposes the
function under its source name; `#export someName` exposes the function under `someName`.

Every include file must contain at least one include-local `#export`. If none are present, resolving that include should
throw a `ProjectIncludeError`.

Exported functions keep their public include names: either their original source names or their `#export` aliases.
Non-exported functions are internal helpers and get deterministic include-id-derived prefixes. Calls inside the same
include source should be rewritten when they target internal helpers.

Repeated `include <id>` lines should be deduped by include id during project preparation. Including the same stdlib file
twice should not create duplicate public signatures or duplicate generated internal helpers.

Example include source:

```8f4e
function sine
#export
param float x
call foldPhase
call sineApprox
functionEnd float

function foldPhase
param float x
functionEnd float

function sineApprox
param float x
functionEnd float
```

Compiler input should become equivalent to:

```8f4e
function sine

param float x
call __8f4e_std_math_trig_sine__foldPhase
call __8f4e_std_math_trig_sine__sineApprox
functionEnd float

function __8f4e_std_math_trig_sine__foldPhase
param float x
functionEnd float

function __8f4e_std_math_trig_sine__sineApprox
param float x
functionEnd float
```

## Design Decisions

- Include-local `#export` is required. There is no basename fallback and no compatibility mode.
- Include-local `#export` is a visibility marker, not a Wasm export directive.
- Include-local `#export` lines are replaced with empty lines during include expansion.
- Public include functions keep their original names unless `#export <alias>` provides an alias.
- Internal include functions are renamed with a deterministic prefix derived from the include id.
- Internal overload families keep one generated name per original source name, preserving overload grouping.
- Export visibility is per concrete function block. Overload families may be split so some overloads are public and some
  remain internal when the stdlib author chooses that shape deliberately.
- Include-local `#export <alias>` should behave like the existing export directive's alias form, except it aliases the
  function's public include name rather than creating a Wasm export.
- Duplicate include declarations for the same include id are ignored after the first successful expansion.
- Normal project functions keep the existing `#export` behavior and validation rules.

## Anti-Patterns

- Do not let stdlib `#export` lines pass through to the compiler as Wasm exports.
- Do not preserve old behavior where every function in an include is public.
- Do not infer public names from file basenames.
- Do not add compatibility shims for unmarked include files.
- Do not add include loading or stdlib-specific behavior to the compiler proper. Includes should still reduce to plain
  function blocks before compiler input reaches semantic analysis and code generation.
- Do not reject partially exported overload families just because other overloads with the same source name remain
  internal.

## Implementation Plan

### Step 1: Extend Include Source Expansion

- Update `packages/compiler/packages/project-preparser/src/functionIncludes.ts`.
- Split include source into function blocks as today, preserving original line count.
- Detect include-local `#export` lines inside each function block.
- Replace each include-local `#export` line with an empty string before returning compiler input.
- Throw `ProjectIncludeError` when an include file has zero exported function blocks.
- Support the same optional alias shape as normal function exports: bare `#export` or `#export <alias>`.
- Track expanded include ids and skip later duplicate declarations for the same include id.

### Step 2: Prefix Internal Functions

- Derive an identifier-safe prefix from the include id, for example `__8f4e_std_math_trig_sine__`.
- Identify public names from function blocks containing include-local `#export`, using the alias when one is present and
  the source name otherwise.
- Identify internal source names from function blocks without include-local `#export`.
- Rewrite internal function declaration names to their prefixed names.
- Rewrite exported function declaration names to their public aliases when include-local `#export <alias>` is used.
- Keep overloads with the same original internal name under the same prefixed name.

### Step 3: Rewrite Internal Calls

- Rewrite `call <name>` inside the included source when `<name>` is an internal function from the same include file.
- Preserve calls to public include functions, project functions, imported functions, and built-in instructions unchanged.
- Support normal call lines and inline call arguments by rewriting only the call target argument.
- Keep line contents otherwise stable so syntax and semantic diagnostics stay useful.
- For a source name with mixed public/internal overload visibility, keep rewriting source-based and conservative. The
  preparser cannot infer which overload a `call <name>` targets from text alone. If the original call target is also a
  public include name, do not silently rewrite it to the internal prefixed name. Prefer an explicit validation error for
  ambiguous mixed-visibility call targets, or require aliases/distinct helper names to make the source rewrite
  unambiguous.

### Step 4: Update Stdlib Sources

- Add bare `#export` markers to every currently public stdlib function block.
- For overload families, mark every overload that should remain public.
- Add or refactor helper functions only after the include rewrite behavior is tested.
- Regenerate the stdlib manifest if the implementation changes manifest content. If manifest content remains file-id-only,
  no manifest schema change is required.

### Step 5: Update Tests and Documentation

- Add project-preparser tests for:
  - include files with one exported function and one internal helper;
  - multiple exported functions from one include file;
  - exported overload families;
  - internal overload families;
  - partially exported overload families;
  - aliased include-local exports;
  - calls from public functions to internal helpers;
  - zero-export include files failing with `ProjectIncludeError`;
  - ambiguous mixed-visibility call targets failing or requiring aliases;
  - include-local `#export` lines becoming blank lines.
- Update compiler/stdlib integration tests that include existing stdlib files.
- Update `packages/compiler/docs/standard-library.md` to explain include-local exports.
- Update `packages/compiler/packages/stdlib/README.md` to document the stdlib authoring rule.

## Validation Checkpoints

- `npx nx run @8f4e/project-preparser:test`
- `npx nx run @8f4e/project-preparser:typecheck`
- `npx nx run @8f4e/stdlib:generate-manifest`
- `npx nx run @8f4e/stdlib:test`
- `npx nx run compiler:test`
- `npx nx run compiler:typecheck`
- `npx nx run @8f4e/examples:test`

## Success Criteria

- [ ] Include files with no `#export` marker fail during include expansion.
- [ ] Include-local `#export` markers expose functions to the project without creating Wasm exports.
- [ ] Include-local `#export <alias>` exposes the function under the alias.
- [ ] Include-local `#export` marker lines are replaced with empty lines, preserving line numbers.
- [ ] Internal include helper declarations are prefixed deterministically.
- [ ] Calls inside include files are rewritten when they target internal helpers.
- [ ] Multiple public functions can be exposed from one include file.
- [ ] Public and internal overload groups remain valid even when only some overloads are exported.
- [ ] Ambiguous mixed-visibility call targets are rejected or require explicit aliases/distinct helper names.
- [ ] Repeated include declarations for the same include id are deduped.
- [ ] Existing stdlib includes compile after adding explicit `#export` markers.

## Affected Components

- `packages/compiler/packages/project-preparser/src/functionIncludes.ts` - include visibility detection, prefixing, call
  rewriting, and include diagnostics.
- `packages/compiler/packages/project-preparser/src/functionIncludes.test.ts` - unit coverage for include-local export
  behavior.
- `packages/compiler/packages/project-preparser/src/functionIncludes.test.ts` - project include expansion behavior.
- `packages/compiler/packages/stdlib/std/**/*.8f4e` - explicit `#export` markers for public stdlib functions.
- `packages/compiler/docs/standard-library.md` - user-facing include and stdlib docs.
- `packages/compiler/packages/stdlib/README.md` - stdlib authoring docs.
- `packages/compiler/tests/stdlib` - integration coverage for compiled stdlib includes.

## Risks & Considerations

- **Context-sensitive directive meaning**: `#export` means Wasm export in project source but include-public symbol in
  include source. Keep this context split contained inside the project-preparser.
- **Diagnostics**: blanking include-local `#export` lines preserves line numbers, but generated helper names may appear in
  diagnostics unless source metadata also records original and generated names.
- **Overload visibility**: partial visibility for one source-name overload family is allowed, but text-only call rewriting
  cannot disambiguate public and internal overloads with the same call target. Prefer explicit aliases or validation for
  ambiguous internal calls.
- **Call rewriting**: rewrite only call targets, not arbitrary identifiers, comments, locals, params, constants, or memory
  names.
- **Generated name stability**: derive prefixes from include ids so generated helper names are deterministic across CLI,
  browser, and editor include resolvers.

## Related Items

- **Related**: `docs/brainstorming_notes/048-project-preparser-compiler-input-pipeline.md`
- **Related**: `docs/todos/452-add-reachability-based-function-pruning.md`

## Notes

- This TODO records the 2026-06-19 brainstorming decision to require explicit include-local `#export` markers.
- The no-fallback rule is intentional because the project is unreleased.
- The compiler should continue to receive only irreducible source blocks: entries/modules, constants, functions, and
  prototypes. Include visibility is resolved before that boundary.
