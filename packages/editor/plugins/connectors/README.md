# Connectors plugin

`@8f4e/editor-plugin-connectors` owns input/output connector sprites, expanded declaration labels, and connection
geometry. Install `connectorsPlugin` on its own to draw the labels and widgets without a GPU wire layer. Browser
compositions that want wires also install `@8f4e/editor-plugin-wires`. Compilation and memory resolution do not
depend on either plugin.

The plugin expands compiler-reported `shape` declarations and `paramShape` function parameters for display, reserving
rows through the generic layout contribution API. Labels stay private and draw with connectors through the ordered
block drawer registry. Inherited declaration labels and connector endpoints use the same ordered memory rows. Hidden source and
disabled blocks reserve no expansion rows. Source edits, recompilation, font changes, and group navigation refresh
the layout; disposal removes its labels and reserved space. The compiler owns all language semantics.

The shared geometry code derives pointer inputs, pointer-slot address outputs, and public value outputs from the
compiler memory plan, including inherited shape declarations and exposed memory on nested project groups. One
derivation pass produces both connector lists.
Module connectors belong only to the block selected by the compiler's `projectBlockId`, so overridden definitions do
not add duplicate endpoints and selecting a same-named block cannot redirect wires.
Each connection tracker keeps its own geometry cache. After a completed layout batch for the current `ProjectLevel`,
it rebuilds its byte-address index from that group's blocks. Batches in other groups leave the active index unchanged.
Runtime pointer values are read when visiting connections, so wires follow live memory without recompilation.
Fixed reference slots such as `float& input &source:output` also produce input connectors, positioned at their
declaration rows. Their wires use the target byte address already resolved in the compiler's reference-slot metadata, without
reading a pointer slot from runtime memory. Every compiled module supplies a reference-slot map, empty when it has no
fixed declarations. Target type and buffer metadata come from the backing declaration in the allocation plan.
Allocated pointer rows and their group exposures show an `[&]` output for the slot address. Fixed references and
live pointers to that slot can both connect to it. The input on the pointer row follows its live value.

`createConnectorConnections(state, events)` tracks the settled layout independently of the connector presentation
plugin. Its `visit(memoryViews.int32, visitor)` method resolves live or fixed targets and supplies the active
input/output endpoints in viewport-relative pixels, including offscreen endpoints. Dispose it with the owning renderer.

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
