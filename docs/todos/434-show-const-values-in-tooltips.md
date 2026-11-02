---
title: 'TODO: Show const values in declaration tooltips'
priority: Medium
effort: 2-4h
created: 2026-05-28
issue: https://github.com/8f4e/8f4e/issues/720
status: Open
completed: null
---

# TODO: Show const values in declaration tooltips

## Problem Description

The selected-line tooltip can show instruction documentation, stack analysis, module execution order, and live memory values, but it does not show the resolved value of a `const` declaration.

Current state:
- `const` declarations may resolve literal values, expressions, and imported compile-time facts during compilation.
- The tooltip has no way to display the final calculated constant value on the declaration line.
- Users reading a constants block must mentally evaluate expressions such as `const HALF SIZE/2`.

Why this is a problem:
- computed constants are harder to inspect while editing
- constants blocks are less useful as readable configuration panels
- the compiler already knows the value, so the editor should be able to surface it without duplicating semantic evaluation

## Proposed Solution

Expose enough resolved constant metadata from the compiler result for the tooltips plugin to display it in selected-line tooltips.

When the highlighted line is a `const` declaration and the compiled result contains metadata for that constant, append compact tooltip rows:

```text
value: 4
type: int
```

If the value or type is unavailable, omit the unavailable row entirely. Do not show placeholder text such as `value unavailable`.

## Anti-Patterns

- Do not display constant values on usage lines such as `push SIZE` or memory declarations that reference constants.
- Do not re-evaluate constant expressions in editor-state from raw source text.
- Do not show stale or guessed values when the compiler result does not contain resolved constant metadata.
- Do not make the tooltip noisier for non-`const` lines.

## Implementation Plan

### Step 1: Expose resolved constants from the compiler result
- Add an optional resolved constant map to `CompiledModule` or another compiler-returned metadata shape.
- Populate it from compiler-owned semantic constant data after normalization has resolved expression values.
- Include enough information for display: numeric `value` and integer/float type facts.

### Step 2: Resolve selected const declarations in editor-state
- Add a source-line helper that extracts the declared constant id only for `const` declaration lines.
- In the tooltip effect, use the selected code block's `moduleId` plus the extracted constant id to look up compiler metadata.
- Return no tooltip additions when metadata is missing.

### Step 3: Render concise constant metadata rows
- Extend tooltip content building to append `value: <number>` when available.
- Append a compact type row when available, likely `type: int`, `type: float`, or `type: float64` depending on compiler metadata.
- Keep existing docs, stack analysis, and live memory rows unchanged.

## Validation Checkpoints

- `npx nx run @8f4e/compiler:test -- --run tests/instructions/constants.test.ts tests/instructions/constantExpressions.test.ts`
- `npx nx run @8f4e/editor-plugin-tooltips:test -- --run src/helpers/sourceLine.test.ts src/helpers/content.test.ts src/state/effect.test.ts`
- `npx nx run-many --target=typecheck --projects=@8f4e/language-spec,@8f4e/compiler,@8f4e/editor-state`

## Success Criteria

- [ ] Highlighting a `const` declaration with resolved compiler metadata shows the calculated value.
- [ ] Highlighting the same line shows the constant type when that type is available.
- [ ] Highlighting constant usages does not show constant value/type rows.
- [ ] Missing or stale compiler metadata produces no extra value/type tooltip rows.
- [ ] Editor-state does not parse or evaluate constant expressions itself.

## Affected Components

- `packages/compiler/packages/language-spec/src/compiled.ts` - compiler result metadata contract.
- `packages/compiler/src/compiler.ts` - resolved constant metadata returned to consumers.
- `packages/editor/plugins/tooltips/src/` - selected-line tooltip lookup and rendering.

## Risks & Considerations

- **Payload shape**: exposing all constants on every compiled module may increase compiler-worker message size slightly. Prefer optional metadata and omit empty maps.
- **Imported constants**: only the highlighted declaration line should show its own declared constant. Avoid showing imported constants unless they are declared on the selected line.
- **Type naming**: decide a stable display vocabulary from current compiler metadata before implementation.
- **Compile errors**: if compilation fails or metadata is stale, omit the constant rows.

## Related Items

- **Related**: `docs/todos/archived/412-expose-compiler-stack-analysis-results.md`
- **Related**: `docs/todos/archived/329-replace-literal-only-const-collection-with-semantic-namespace-prepass.md`
- **Related**: `docs/todos/archived/352-unify-semantic-const-collection-and-namespace-import-rules.md`

## Notes

- Scope was intentionally narrowed during discussion: show value and type only when the declaration line itself is highlighted.
