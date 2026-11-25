---
title: 'TODO: Add browser-driven accessibility color-scheme overrides'
priority: Medium
effort: 2-4d
created: 2026-10-18
issue: null
status: Open
completed: null
---

# TODO: Add browser-driven accessibility color-scheme overrides

## Problem Description

Projects can define detailed editor color schemes, but the editor has no global accessibility layer that can replace
those colors when the browser reports a user preference such as increased contrast or forced colors. The editor renders
its interface into a canvas from a generated sprite atlas, so CSS media queries alone cannot reliably adapt the colors
drawn inside the editor.

Browsers expose some relevant signals, including `prefers-contrast` and `forced-colors`, but they do not expose whether
a user has a color-vision deficiency. The first goal is therefore to investigate the usable browser signals and add
alternative color schemes that can be selected automatically from those signals. Manual color-vision-friendly choices
can be designed separately without pretending that the browser can infer a user's vision.

## Proposed Solution

Introduce an accessibility color-scheme override layer between the project-resolved color scheme and sprite generation.
Keep project colors as the default, then resolve a complete, tested alternative palette when supported browser
preferences request it. Preference changes should update the effective scheme and regenerate the sprite atlas without
modifying project source or persisted project configuration.

Start with browser-driven alternatives for:

- increased contrast through `(prefers-contrast: more)`;
- forced/system colors through `(forced-colors: active)`;
- light or dark variants only where `(prefers-color-scheme)` materially improves the accessibility palette.

Define precedence explicitly. Forced colors should take priority over an inferred high-contrast palette, and an
unsupported or absent preference should leave the project scheme unchanged. Keep preference detection outside the
renderer and inject its result so editor-core and sprite-generation tests remain deterministic in non-browser
environments.

## Anti-Patterns

- Do not treat the absence of a media-query match as evidence that the user has no visual impairment.
- Do not attempt to detect screen-reader use or color-vision deficiency through fingerprinting or behavior heuristics.
- Do not mutate `@config color.*` directives or save an automatically selected palette into project source.
- Do not rely on hue alone for errors, assertions, connector direction, focus, or other meaningful state.
- Do not apply CSS only to the surrounding page while leaving the canvas-rendered editor unchanged.

## Implementation Plan

### Step 1: Define the browser-preference contract

- Document the supported values and current browser behavior for `prefers-contrast`, `forced-colors`, and any relevant
  `prefers-color-scheme` interaction.
- Decide the effective-scheme precedence and fallback behavior.
- Represent resolved browser preferences as an injected, platform-neutral value rather than reading `matchMedia`
  throughout editor-core.

### Step 2: Design and validate alternative palettes

- Add complete semantic palettes for the supported automatic modes, including text, module fills, wires, connectors,
  selections, dialogs, plots, meters, assertions, and error states.
- Check ordinary text against a 4.5:1 target and meaningful non-text graphics and controls against a 3:1 target.
- Ensure critical distinctions remain understandable without hue alone; add non-color cues where the existing rendering
  cannot satisfy that requirement through a palette.
- Investigate whether browser system-color values can be resolved reliably during canvas sprite generation; otherwise
  use a documented, tested forced-colors palette.

### Step 3: Resolve the effective color scheme

- Layer the selected accessibility override over the resolved project color scheme without changing the project-owned
  configuration.
- Pass the effective scheme to every sprite-generation entry point, including initial startup and later regeneration.
- Keep editor initialization usable when browser preference APIs are unavailable.

### Step 4: React to preference changes

- Subscribe once to relevant media-query changes in the browser composition and update the effective preference state.
- Regenerate and install the sprite atlas through the existing sprite-sheet lifecycle.
- Remove listeners during disposal and preserve the existing stale-generation protection when preferences change
  repeatedly.

### Step 5: Add automated and visual coverage

- Test preference resolution, precedence, unsupported APIs, and runtime changes with injected media-query results.
- Verify that project colors remain unchanged when no accessibility preference matches.
- Add sprite-generator or web UI visual coverage for every automatic palette and representative widgets.
- Manually inspect the editor with browser/OS high-contrast and forced-color settings where supported.

## Validation Checkpoints

- Run editor-core, editor-state, sprite-generator, and web UI tests through their Nx targets.
- Run the corresponding typechecks and the editor website production build.
- Verify preference changes replace the canvas palette without reloading or modifying project source.
- Check representative text, wires, controls, focus/selection, error, and assertion colors with an automated contrast
  calculation that handles alpha compositing against their actual backgrounds.
- Confirm listener cleanup and rapid preference changes do not install a stale sprite atlas.

## Success Criteria

- [ ] At least two complete accessibility-oriented color schemes are available to the editor.
- [ ] A supported increased-contrast browser preference automatically selects the intended high-contrast scheme.
- [ ] Forced-colors mode selects a compatible scheme with higher precedence than other inferred preferences.
- [ ] Preference changes take effect at runtime through sprite-atlas regeneration.
- [ ] No matching or supported browser preference preserves the project's configured color scheme exactly.
- [ ] Automatic overrides never modify serialized project source or persisted project color configuration.
- [ ] Text and meaningful non-text roles meet the documented contrast targets in the tested palettes.
- [ ] Important state is not communicated through hue alone.
- [ ] Automated tests cover preference resolution, fallbacks, precedence, regeneration, and cleanup.

## Affected Components

- `packages/editor/compositions/editor-default/` - Browser preference detection and composition-level lifecycle.
- `packages/editor/core/editor-core/src/index.ts` - Initial effective color scheme passed to sprite generation.
- `packages/editor/core/editor-core/src/spriteSheetManager.ts` - Runtime regeneration from the effective scheme.
- `packages/editor/core/editor-state/src/features/color/` - Color state and override resolution.
- `packages/editor/core/sprite-generator/` - Alternative palettes and visual tests.
- `packages/editor/core/editor-core/docs/color-paths.md` - Document override behavior and semantic color roles.

## Risks & Considerations

- Browser and operating-system support for `prefers-contrast` varies, so automatic selection must remain a progressive
  enhancement with a predictable fallback.
- `forced-colors: active` communicates use of a forced palette, not necessarily a request for greater contrast. Preserve
  the user's system choices where browser APIs expose them reliably.
- Translucent colors must be evaluated after compositing against their actual canvas background.
- A global override may intentionally reduce a project's visual identity; accessibility and legibility take precedence
  while the override is active.
- Future manual modes should include a color-vision-friendly option because color perception cannot be detected
  automatically. That control should use explicit user choice and must not be inferred from unrelated preferences.

## Related Items

- [Color paths](../../packages/editor/core/editor-core/docs/color-paths.md)

## References

- [W3C Media Queries Level 5](https://www.w3.org/TR/mediaqueries-5/)
- [W3C CSS Color Adjustment Module Level 1](https://www.w3.org/TR/css-color-adjust-1/)
- [WCAG 2.2: Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [WCAG 2.2: Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
- [WCAG 2.2: Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)

## Archive Instructions

Set `status: Completed` and the completion date, move this file to `docs/todos/archived/`, and update
`docs/todos/_index.md`.
