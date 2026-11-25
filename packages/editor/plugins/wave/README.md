# Wave Plugin

`@8f4e/editor-plugin-wave` provides waveform displays through three directives:

```txt
; @wave <pointerSource> <elementCount> [absolutePointerSource]
; @wave2 <pointerSource> <elementCount> [absolutePointerSource]
; @wave4 <pointerSource> <elementCount> [absolutePointerSource]
```

`@wave` adds two rows, `@wave2` four, and `@wave4` eight. The source can be an address such as `&samples` or a typed
pointer memory or a fixed reference such as `float& buffer &samples`. Use its bare name (`; @wave buffer 128`).
The count can be a positive integer, a live memory value, or `count(samples)` / `count(buffer)`. The optional third
argument supplies an absolute playhead address.

For a double pointer such as `int16** address`, use `; @wave *address length`. The display follows both live
pointer values and reads samples using the final pointee type (`int16` in this case). The optional playhead
also accepts a dereferenced double pointer. All three waveform height variants support this syntax.

```ts
import { wavePlugin } from '@8f4e/editor-plugin-wave';

const editor = await initEditor(canvas, { ...options, plugins: [wavePlugin] });
```

Each installation keeps its wave data in a private `wavesByBlock` map.
It contributes layout rows through the layout service, subscribes to accepted compiler metadata and block layouts,
and draws through the code-block drawer hook. Disposal releases its subscriptions, layout contributions, and drawer.

Sample types come from the addressed declaration or pointer's pointee type. The drawer supports signed and unsigned
8-bit and 16-bit integers, signed 32-bit integers, float32, and float64. Integer bounds follow their type; floating
samples use `-1..1`. It reads samples, pointer starts, live counts, and playheads from the current memory each frame.
Group-exposed memory and fixed references use the same public memory resolution as module declarations. Fixed
references supply the target address without reading a runtime pointer slot, including when used as a playhead.
Source, sample type, and count are prepared through the shared `prepareBuffer` helper. Drawing uses shared address,
typed-index, and count readers, including for the playhead; waveform geometry and colors remain local.

Each waveform reads at most 262,144 samples per frame, spread across its display columns. Small buffers are scanned
fully each frame. Large buffers build their per-column minimum and maximum over successive frames, visiting every
sample so isolated peaks remain visible. The first overview refines progressively; later sweeps keep the last complete
waveform visible while rebuilding it. The scan reads current memory every frame, so buffer changes appear as the
next sweep completes, and playheads update every frame. There is no content-change detection or invalidation logic.

The display uses `darkSurface` for its background, `highlightBase` for the waveform, and `onDarkAccent` for the
playhead. The playhead color is chosen for the dark display independently of the code text colors.

```bash
npx nx run @8f4e/editor-plugin-wave:build
npx nx run @8f4e/editor-plugin-wave:test
npx nx run @8f4e/editor-plugin-wave:typecheck
npx nx run @8f4e/editor-plugin-wave:test:screenshot
```
