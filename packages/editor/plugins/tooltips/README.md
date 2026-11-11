# Tooltips Plugin

`@8f4e/editor-plugin-tooltips` adds documentation beside the selected code line, including compiler stack analysis,
named call signatures, module execution order, and live memory values. It owns the content, layout, entrance animation, and drawing.

```ts
import { tooltipsPlugin } from '@8f4e/editor-plugin-tooltips';

const editor = await initEditor(canvas, { ...options, plugins: [tooltipsPlugin] });
```

Core installs no plugins by default. The `codeLineSelection` feature flag
controls whether selected-line tooltips are visible.

Each installation keeps its tooltip state private and registers a block drawer. Registration order determines its
layering. It subscribes to selection,
source, compiler, grid, and sprite changes. Live values are read from the current runtime memory during drawing.
Disposal removes its subscriptions, sprite-reload listener, and drawer contribution.

Module-specific stack analysis, execution order, and live-memory details belong only to the active source definition.
Overridden blocks retain instruction documentation without displaying another definition's compiler metadata.

Fixed reference declarations (`int&`, `int8&`, `int8u&`, `int16&`, `int16u&`, `float&`, and `float64&`) show their
resolved target byte address as `value` and the live target value as `deref`. Buffer targets show their first element.
Fixed references allocate no pointer storage. Both fixed references and allocated declarations resolve targets
through the shared editor-state memory resolver during preparation and produce the same prepared read variants:
static text, a typed memory read, or a live pointer read. Recompilation refreshes the prepared addresses and read
formats. Drawing reads current memory and pointer values without resolving names or distinguishing declaration kinds.
Missing compilation metadata leaves documentation visible without live rows, and unavailable target memory shows `?`.

Preparation classifies the current selected source line once. Target lookup, documentation, declaration labels, and
execution order share that description. Instruction signatures use the accepted parsed source arguments, including
operands on `-` continuation lines, so their stack effects agree with the compiler's before/after analysis. Before
compilation or when an edit changes the instruction, signatures fall back to the current source description.
Incomplete edits retain instruction documentation while accepted compiler metadata catches up.

For `call` instructions, successful compilation supplies the selected overload's parameter names, types, and return
types. The tooltip uses the callable name from the selected source line and wraps long signatures between parameters,
keeping each name/type pair together. A pair wider than the normal wrap width expands the tooltip to fit. Parameters
expanded by `paramShape` appear in declaration order. Calls without resolved compiler metadata show the generic call
signature.

The plugin uses the existing tooltip font and fill entries in the sprite palette.

```bash
npx nx run @8f4e/editor-plugin-tooltips:build
npx nx run @8f4e/editor-plugin-tooltips:test
npx nx run @8f4e/editor-plugin-tooltips:typecheck
npx nx run @8f4e/editor-plugin-tooltips:test:screenshot
```
