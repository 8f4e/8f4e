# Wave Plugin

`@8f4e/editor-plugin-wave` provides waveform displays through three directives:

```txt
; @wave <pointerSource> <elementCount> [absolutePointerSource]
; @wave2 <pointerSource> <elementCount> [absolutePointerSource]
; @wave4 <pointerSource> <elementCount> [absolutePointerSource]
```

`@wave` adds two rows, `@wave2` four, and `@wave4` eight. The source can be an address such as `&samples` or a typed
pointer memory. The count can be a positive integer, a live memory value, or `count(samples)`. The optional third
argument supplies an absolute playhead address.

```ts
import { wavePlugin } from '@8f4e/editor-plugin-wave';

const editor = await initEditor(canvas, { ...options, plugins: [wavePlugin] });
```

The default editor includes this plugin. Each installation keeps its wave data in a private `wavesByBlock` map.
It contributes layout rows and callbacks through the generic directive API and draws through the code-block drawer
hook. Disposal unregisters all three definitions and the drawer.

Sample types come from the addressed declaration or pointer's pointee type. The drawer supports signed and unsigned
8-bit and 16-bit integers, signed 32-bit integers, float32, and float64. Integer bounds follow their type; floating
samples use `-1..1`. It reads samples, pointer starts, live counts, and playheads from the current memory each frame.
Group-exposed memory uses the same public memory resolution as module declarations.

The plugin uses the existing `waveformBackground`, `waveform`, and `scanLine` palette entries.
Palette contributions remain tracked in [TODO 507](../../../../docs/todos/507-design-plugin-fill-color-contributions.md).

```bash
npx nx run @8f4e/editor-plugin-wave:build
npx nx run @8f4e/editor-plugin-wave:test
npx nx run @8f4e/editor-plugin-wave:typecheck
npx nx run @8f4e/editor-plugin-wave:test:screenshot
```
