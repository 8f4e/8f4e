# Connectors plugin

`@8f4e/editor-plugin-connectors` owns input/output connector sprite layout and presentation.
Install `connectorsPlugin` on its own to draw the widgets without a GPU wire layer. Browser
compositions that want wires also install `@8f4e/editor-plugin-wires`. Compilation and memory resolution do not
depend on either plugin.

Connector sprites draw through the ordered block drawer registry. They follow declaration rows and group
`expose` rows, including the spacing contributed by other layout plugins. Group rows use compiler-resolved
exposures and, while compilation is pending, the current rows recorded by editor source processing.

Sprite layout derives pointer inputs, pointer-slot address outputs, and public value outputs from the compiler
memory plan, including exposed memory on nested project groups.
Module connectors belong only to the block selected by the compiler's `projectBlockId`, so overridden definitions do
not draw duplicate connectors. Fixed reference slots such as `float& input &source:output` produce input sprites
at their declaration rows. Allocated pointer rows and their group exposures show an `[&]` output for the slot address.

Input `[ ]` and output `[*]` connectors are composed at runtime from the shared fill and font sprites. Both use a
three-cell `surfaceOverlay` background; input brackets use `primaryBase`, and output brackets use `secondaryBase`.
The output star selects `primaryDark3`, `primaryDark2`, `primaryDark1`, `primaryBase`, `warningBase`, or `negativeBase`
using the existing calibrated value scale. Each input submits three sprites and each output four, in the same sprite
batch. The generator does not prerender connector icons.

## Verification

- `npx nx run @8f4e/editor-plugin-connectors:build`
- `npx nx run @8f4e/editor-plugin-connectors:test`
- `npx nx run @8f4e/editor-plugin-connectors:typecheck`
- `npx nx run @8f4e/editor-plugin-connectors:test:screenshot`
