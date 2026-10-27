# Watch Plugin

`@8f4e/editor-plugin-watch` owns the `watch` directive's arguments, layout, derived data, and rendering.
The default editor installs it; editor-core installs no plugins automatically.

```ts
import { createWatchPlugin } from '@8f4e/editor-plugin-watch';

const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const plugin = createWatchPlugin({ prefersReducedMotion: () => motionPreference.matches });
```

Pass the plugin in the editor's `plugins` array. Core retains generic comment parsing, block layout, memory resolution,
and drawing hooks. Feature data lives in a WeakMap created by each installation and never becomes a field in core state.

```txt
; @watch <memoryExpression>
```

Watch also accepts `@w`; inline directives can infer the memory declaration on the same line.
The plugin parses `0b`/`0x` display prefixes and the trailing `&` end-address form before asking core to resolve
the memory reference. Formatting choices remain private to watch.

The browser host supplies `prefersReducedMotion: () => boolean` to the factory. The plugin reads it when drawing; it does not access browser globals.

Cleanup unregisters the directive and drawer. Omit the plugin to remove its behavior and layout space.

```sh
npx nx run @8f4e/editor-plugin-watch:build
npx nx run @8f4e/editor-plugin-watch:test
npx nx run @8f4e/editor-plugin-watch:typecheck
npx nx run @8f4e/editor-plugin-watch:test:screenshot
```
