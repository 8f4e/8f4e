---
title: 'TODO: Add separate color for non-decimal literal base prefixes'
priority: Medium
effort: 4-8h
created: 2026-03-09
issue: https://github.com/8f4e/8f4e/issues/419
status: Completed
completed: 2026-04-17
---

# TODO: Add separate color for non-decimal literal base prefixes

## Problem Description

The editor currently highlights non-decimal numeric literals such as binary and hexadecimal values as a single token. That means the base prefix and the digits share the same color:
- `0b1010`
- `0xFF`

This makes it harder to visually distinguish:
- the fact that the literal is non-decimal
- the prefix (`0b`, `0x`)
- the payload digits that follow

The color scheme also has no dedicated token color for these prefixes, so themes cannot style them independently.

## Proposed Solution

Add a dedicated color entry to the color scheme for numeric literal base prefixes, and update syntax highlighting so `0b` and `0x` are recognized as separate highlighted parts of non-decimal literals.

Terminology:
- `0b` and `0x` should be treated as `base prefixes`

Desired result:
- the base prefix gets its own color
- the remaining digits keep the existing number-related color behavior

Examples:
- `0b1010` => `0b` uses base-prefix color, `1010` uses numeric color
- `0xFF` => `0x` uses base-prefix color, `FF` uses numeric color

## Anti-Patterns

- Do not recolor the whole literal when only the prefix needs a separate token color.
- Do not treat decimal literals as having a base prefix.
- Do not hardcode colors in the highlighter; this should come from the color scheme.
- Do not make the highlighter recognize prefixes differently from the compiler literal syntax.

## Implementation Plan

### Step 1: Extend the color scheme
- Add a dedicated color key for non-decimal numeric base prefixes.
- Thread it through theme definitions, types, defaults, and any sprite/font lookup generation that depends on syntax token categories.

### Step 2: Update syntax highlighting
- Update the 8f4e syntax highlighter so binary and hexadecimal literals are split into:
  - base prefix token
  - remaining digit token
- Keep existing number highlighting behavior unchanged for decimal literals.

### Step 3: Add tests and docs
- Add highlighter tests for binary and hexadecimal literals.
- Add color-scheme/rendering tests if needed for the new token category.
- Document the new color entry and its purpose.

## Validation Checkpoints

- `rg -n "0x|0b|prefix|numbers" packages/editor packages/compiler docs`
- `npx nx run-many --target=test --projects=editor-state,web-ui,sprite-generator`

## Success Criteria

- [ ] Color scheme includes a dedicated color entry for non-decimal literal base prefixes.
- [ ] `0x` and `0b` are highlighted separately from the digits that follow.
- [ ] Decimal literals remain unchanged.
- [ ] Tests cover binary and hexadecimal prefix highlighting.

## Affected Components

- `packages/editor/packages/editor-state` - Update 8f4e syntax highlighting tokenization and tests.
- `packages/editor/packages/sprite-generator` - Add color-scheme support if text token categories are mapped there.
- `packages/compiler/syntax` or shared syntax helpers - Reuse or align literal recognition rules where appropriate.
- `docs` - Document the new color-scheme field.

## Risks & Considerations

- **Token alignment**: Highlighting logic must not drift from actual literal syntax accepted by the compiler.
- **Theme compatibility**: Existing themes need a sensible default for the new color key.
- **Rendering plumbing**: If syntax colors are encoded through sprite/font lookup categories, the new category may require changes beyond the tokenizer.

## Related Items

- **Related**: `docs/todos/288-add-split-hexadecimal-memory-defaults.md`

## Notes

- Preferred terminology: `base prefix`.
- Scope is highlighting/color-scheme behavior, not a change to literal semantics.
