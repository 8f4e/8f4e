# Tooltips Plugin

`@8f4e/editor-plugin-tooltips` adds documentation beside the selected code line, including compiler stack analysis,
named call signatures, module execution order, and live memory values. It owns the content, layout, entrance animation, and drawing.

```ts
import { tooltipsPlugin } from '@8f4e/editor-plugin-tooltips';

const editor = await initEditor(canvas, { ...options, plugins: [tooltipsPlugin] });
```

Core installs no plugins by default. Installing this plugin shows tooltips for the selected code line.

Each installation keeps its tooltip state private and registers a block drawer. Registration order determines its
layering. Selection, completed project changes, compiler, grid, and selected-line geometry changes invalidate the
prepared tooltip. Synchronous notifications coalesce into a microtask that prepares it once from settled inputs
before the next animation frame. An explicit synchronous frame settles pending preparation immediately.
Live values are read from the current runtime memory during drawing.
Disposal removes its subscriptions, event listeners, and drawer contribution.

Module-specific stack analysis, execution order, and live-memory details belong only to the active source definition.
Overridden blocks retain instruction documentation without displaying another definition's compiler metadata.

Fixed reference declarations show their resolved target byte address as `value` and the live target value as
`deref`. Buffer targets show their first element. For `int*&`, `int16*&`, and `float*&`, `deref` shows the pointer
value and `deref twice` shows the typed value at its current address.
Fixed references allocate no pointer storage. Both fixed references and allocated declarations resolve targets
through the shared editor-state memory resolver during preparation. Rows contain static text or a shared prepared
numeric read, which can use fixed storage or a live pointer. The shared memory API owns view selection, typed indices,
and offsets; the plugin owns declaration labels and decimal precision. Recompilation refreshes prepared bindings.
Drawing reads current views without resolving names or distinguishing declaration kinds.
Missing compilation metadata leaves documentation visible without live rows, and unavailable target memory shows `?`.

Preparation classifies the current selected source line once. Target lookup, documentation, declaration labels, and
execution order share that description. Instruction signatures use the accepted parsed source arguments, including
operands on `-` continuation lines, so their stack effects agree with the compiler's before/after analysis. Before
compilation or when an edit changes the instruction, signatures fall back to the current source description.
Incomplete edits retain instruction documentation while accepted compiler metadata catches up.
The shared editor-state `getCurrentCompiledLineForCodeBlock` accessor supplies parsed source and stack facts only
for the current input revision and owning source block, using compiler line numbers directly. Tooltips observe
accepted results and input revisions rather than compilation-progress updates.

For `call` instructions, successful compilation supplies the selected overload's parameter names, types, and return
types. The tooltip uses the callable name from the selected source line and wraps long signatures between parameters,
keeping each name/type pair together. A pair wider than the normal wrap width expands the tooltip to fit.
Calls without resolved compiler metadata show the generic call signature.

Documented functions supply their `; @doc`, `; @param`, and `; @returns` text after the call signature and before
the before/after stack analysis. Each parameter description has a bullet and indented continuation lines.
Documentation is retrieved from the concrete resolved overload, including library
includes and local overrides. Selecting an active `function`, `param`, or `functionEnd` declaration also shows its
relevant documentation. Documentation edits revise compiler inputs; stale results fall back to generic instruction
help until the updated compilation is accepted.

The plugin uses the existing tooltip font and fill entries in the sprite palette.

```bash
npx nx run @8f4e/editor-plugin-tooltips:build
npx nx run @8f4e/editor-plugin-tooltips:test
npx nx run @8f4e/editor-plugin-tooltips:typecheck
```
