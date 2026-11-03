---
title: 'TODO: Remove sprite-generator color helper APIs'
priority: Medium
effort: 0.5-1h
created: 2026-03-14
issue: https://github.com/8f4e/8f4e/issues/420
status: Completed
completed: 2026-03-21
---

# TODO: Remove sprite-generator color helper APIs

## Problem Description

The `@8f4e/sprite-generator` package currently exposes a small set of color derivation helpers:
- `lighten`
- `darken`
- `alpha`
- `mix`

These helpers are implemented in `packages/editor/packages/sprite-generator/src/color-helpers.ts`, re-exported from the package entrypoint, documented in the package README, and used by the example file `packages/editor/packages/sprite-generator/examples/derived-color-scheme.ts`.

If the project no longer wants to support helper-driven derived color schemes as part of the sprite-generator package surface, these exports and their supporting materials should be removed completely.

Important context:
- the software is not released yet
- backward compatibility is not a constraint for this cleanup
- sprite generation itself does not depend on these helpers

## Proposed Solution

Remove the color-helper API surface from `@8f4e/sprite-generator` and clean up all package-local references.

Scope of removal:
- remove the public re-exports from the package entrypoint
- delete the helper implementation file
- delete helper-specific tests
- remove or rewrite helper-focused docs
- remove or rewrite the derived color-scheme example that imports these helpers

Preferred outcome:
- `@8f4e/sprite-generator` exposes only the sprite/color-scheme functionality that is still intended to ship
- no documentation or examples imply that helper-based derived palettes are part of the package

## Anti-Patterns

- Do not leave dead exports in the public API.
- Do not keep the example file importing removed helpers.
- Do not leave README sections advertising helper functions that no longer exist.
- Do not add compatibility shims unless there is a concrete migration need.

## Implementation Plan

### Step 1: Remove the helper exports
- Update `packages/editor/packages/sprite-generator/src/index.ts` to stop exporting `lighten`, `darken`, `alpha`, and `mix`.
- Confirm no other package entrypoints re-export them indirectly.

### Step 2: Remove implementation and tests
- Delete `packages/editor/packages/sprite-generator/src/color-helpers.ts`.
- Delete `packages/editor/packages/sprite-generator/tests/color-helpers.test.ts`.

### Step 3: Clean up examples and docs
- Remove or rewrite `packages/editor/packages/sprite-generator/examples/derived-color-scheme.ts`.
- Update `packages/editor/packages/sprite-generator/README.md` to remove:
  - the Color Helpers section
  - helper usage examples
  - helper API reference entries
- Clean up any references in repo docs that still describe these helpers as active functionality.

### Step 4: Verify package integrity
- Run package tests and typecheck after the cleanup.
- Confirm there are no remaining imports of the removed helpers.

## Validation Checkpoints

- `rg -n "lighten|darken|alpha|mix" packages/editor/packages/sprite-generator docs`
- `npx nx run sprite-generator:test`
- `npx nx run sprite-generator:typecheck`

## Success Criteria

- [ ] `@8f4e/sprite-generator` no longer exports `lighten`, `darken`, `alpha`, or `mix`.
- [ ] The helper implementation and its tests are removed.
- [ ] The derived color-scheme example is removed or rewritten so it does not rely on helper APIs.
- [ ] Package docs no longer describe helper-based color derivation as supported behavior.
- [ ] Package tests and typecheck pass after the cleanup.

## Affected Components

- `packages/editor/packages/sprite-generator/src/index.ts` - remove helper re-exports
- `packages/editor/packages/sprite-generator/src/color-helpers.ts` - remove implementation
- `packages/editor/packages/sprite-generator/tests/color-helpers.test.ts` - remove helper tests
- `packages/editor/packages/sprite-generator/examples/derived-color-scheme.ts` - remove or rewrite helper-based example
- `packages/editor/packages/sprite-generator/README.md` - remove helper documentation
- `docs/todos/_index.md` - optional cleanup if active TODO index text still references color helpers as current package scope

## Risks & Considerations

- **Doc drift**: README, examples, and todo index references can easily get out of sync if only code is removed.
- **Hidden imports**: verify there are no remaining internal imports of `lighten`, `darken`, `alpha`, or `mix`.
- **Intent clarity**: if derived color schemes are still desirable later, reintroduce them deliberately under a different API instead of leaving partial remnants now.

## Related Items

- **Related**: `docs/todos/303-dedupe-font-atlas-rows-for-identical-text-colors.md`
- **Related**: `docs/todos/archived/204-expose-color-helpers-sprite-generator.md`

## Notes

- `hueRotate` is not currently implemented in the codebase, so there is nothing to remove for that name.
- This cleanup is expected to be low-risk because sprite generation uses resolved color strings and does not depend on helper functions internally.
