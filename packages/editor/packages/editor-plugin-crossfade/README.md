# Crossfade Plugin

`@8f4e/editor-plugin-crossfade` owns the `crossfade` directive's arguments, layout, derived data, and rendering.
The default editor installs it; editor-core installs no plugins automatically.

```ts
import { crossfadePlugin } from '@8f4e/editor-plugin-crossfade';

const plugin = crossfadePlugin;
```

Pass the plugin in the editor's `plugins` array. Core retains generic comment parsing, block layout, memory resolution,
and drawing hooks. Feature data lives in a WeakMap created by each installation and never becomes a field in core state.

```txt
; @crossfade <leftFloatAddress> <rightFloatAddress>
```

Crossfades write float32 values to both targets while dragging and consume movement before block or viewport dragging.

Cleanup unregisters the directive and drawer and releases pointer listeners. Omit the plugin to remove its behavior and layout space.

```sh
npx nx run @8f4e/editor-plugin-crossfade:build
npx nx run @8f4e/editor-plugin-crossfade:test
npx nx run @8f4e/editor-plugin-crossfade:typecheck
npx nx run @8f4e/editor-plugin-crossfade:test:screenshot
```
