# Slider Plugin

`@8f4e/editor-plugin-slider` provides a slider control:

```text
; @slider <memoryAddress> [min] [max] [step]
```

The default range is `0..127` for integer memory and `0..1` for floating-point memory. An optional positive step snaps
values within the range. Each slider adds two rows below its directive and fills the block's available content width.
Clicks and drags update runtime memory; the handle reads live memory on each frame.

```ts
import { sliderPlugin } from '@8f4e/editor-plugin-slider';

const editor = await initEditor(canvas, { ...options, plugins: [sliderPlugin] });
```

The default editor includes this plugin. Each installation owns its slider geometry and memory bindings in a private
`slidersByBlock` map, plus its active drag. A capture listener consumes slider movement before viewport panning.
The **Save slider values to code** menu action updates the original declaration defaults, including references through
group aliases, and preserves inline comments. Runtime dragging leaves source text unchanged.

Disposal removes the directive, drawer, menu action, and event listeners. Generic parsing, layout, memory resolution,
and declaration editing remain in core.

```bash
npx nx run @8f4e/editor-plugin-slider:build
npx nx run @8f4e/editor-plugin-slider:test
npx nx run @8f4e/editor-plugin-slider:typecheck
npx nx run @8f4e/editor-plugin-slider:test:screenshot
```
