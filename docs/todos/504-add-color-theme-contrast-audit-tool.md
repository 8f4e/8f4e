---
title: 'TODO: Add a color-theme contrast audit tool'
priority: Medium
effort: 1-2d
created: 2026-10-21
issue: null
status: Open
completed: null
---

# TODO: Add a color-theme contrast audit tool

## Problem Description

Editor themes generate many foreground and background shades from a small base palette, but there is no automated way to verify
that critical elements remain distinguishable after those colors are combined. Visual regression tests detect pixel
changes, but they do not measure legibility. A theme can therefore render a control marker, text label, connector, or
status indicator with nearly the same color as its immediate background without failing a test.

Controls share generated palette shades, so a low-contrast drawer choice can make buttons, switches, and sliders
difficult to read. The palette resolver provides readable aliases for specific backgrounds, but arbitrary shade pairs
and composited overlays still need auditing. Similar risks exist
for module text, dialogs, tooltips, errors, highlighted menu items, connectors, and meaningful non-text graphics.

## Proposed Solution

Add a reusable contrast-audit tool close to the sprite-generator color model. It should accept a resolved palette
or base overrides resolved through the same code as the editor, evaluate a maintained registry of critical semantic
foreground/background relationships chosen by drawers, and report the measured ratio, required target, and pass/fail result for each
relationship.

Each registry entry should identify:

- the foreground palette token selected by the drawer;
- the immediate background or ordered compositing stack;
- whether the element is text or meaningful non-text UI;
- the target contrast ratio and a short explanation of the relationship.

The calculator must handle alpha compositing before measuring contrast. Provide both human-readable output for theme
authors and structured output for automated tests or CI. Start with the default scheme and bundled example themes, then
make it easy for other consumers to audit a `ResolvedPalette` without depending on the editor UI.

## Anti-Patterns

- Do not compare every possible pair of theme colors; audit only relationships that can actually overlap in rendering.
- Do not compare translucent source values without compositing them against their real background stack.
- Do not treat screenshot approval as evidence that a color pair has sufficient contrast.
- Do not make the pure contrast calculator depend on browser canvas APIs or project-source parsing.
- Do not fail decorative color relationships that carry no text, control boundary, state, or other meaningful signal.

## Implementation Plan

### Step 1: Define the critical relationship registry

- Inventory rendered foreground/background pairs across editor text, menus, dialogs, tooltips, errors, connectors, and
  interactive controls.
- Represent each relationship as typed data using palette tokens rather than duplicated literal colors.
- Include `inkOn` over `inkBase` as the first control-specific case.

### Step 2: Implement contrast measurement

- Add pure color parsing, alpha compositing, relative-luminance, and contrast-ratio helpers, reusing an existing color
  utility if the repository already has one suitable for the task.
- Cover opaque, translucent, equivalent, high-contrast, and multi-layer compositing cases with focused tests.
- Return actionable diagnostics containing the paths, resolved colors, measured ratio, and required target.

### Step 3: Add a theme-audit entry point

- Accept either a `ResolvedPalette` or overrides passed through the production `resolvePalette` path.
- Provide a command or Nx target that prints a compact report and exits non-zero when required relationships fail.
- Offer structured results so package tests can assert individual failures without parsing terminal text.

### Step 4: Cover repository themes

- Audit the default color scheme and the color configurations bundled with example projects.
- Document intentional exceptions narrowly instead of weakening a target for every theme.
- Add the audit to the appropriate verification workflow once the current theme set has an accepted baseline.

## Validation Checkpoints

- Run sprite-generator unit tests and typecheck through Nx.
- Verify known black/white, same-color, translucent, and layered examples against independently calculated ratios.
- Confirm a theme with a low-contrast drawer shade pair fails with a diagnostic naming both tokens.
- Confirm the default theme and every bundled theme are enumerated by the repository audit command.

## Success Criteria

- [ ] A pure API measures contrast for a resolved editor color scheme.
- [ ] Critical foreground/background relationships chosen by drawers are defined in one typed registry.
- [ ] Alpha colors are composited against their actual background stack before measurement.
- [ ] Reports identify the semantic paths, resolved colors, measured ratio, and required target.
- [ ] The tool supports both human-readable and structured output.
- [ ] Default and bundled example themes can be audited through an Nx target.
- [ ] Automated coverage includes the shared control-knob foreground/background pair.

## Affected Components

- `packages/editor/packages/editor-core/packages/editor-palette/` - Color resolution and contrast helpers.
- `packages/editor/packages/editor-core/packages/web-ui/packages/sprite-generator/` - Atlas integration,
  relationship registry, and unit tests.
- `packages/examples/src/projects/` - Bundled theme inputs and any narrowly documented fixes or exceptions.
- `packages/editor/packages/editor-core/docs/color-paths.md` - Documentation of audited semantic relationships.
- Nx project configuration - A reusable contrast-audit target for local checks and CI.

## Risks & Considerations

- A semantic role may render over different backgrounds in different states; the registry must describe each real
  critical relationship rather than assume one universal background.
- Translucent canvas layers can require more than one compositing step, and using the wrong backdrop produces a
  misleading ratio.
- Contrast targets differ between ordinary text and meaningful non-text UI. Store the target per relationship instead
  of applying one threshold globally.
- Some failures may expose a need for non-color cues rather than a different palette; the report should not imply that
  changing color is always the correct fix.

## Related Items

- [TODO 502: Add browser-driven accessibility color-scheme overrides](502-add-browser-driven-accessibility-color-scheme-overrides.md)
- [Color paths](../../packages/editor/packages/editor-core/docs/color-paths.md)

## References

- [WCAG 2.2: Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [WCAG 2.2: Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)

## Archive Instructions

Set `status: Completed` and the completion date, move this file to `docs/todos/archived/`, and update
`docs/todos/_index.md`.
