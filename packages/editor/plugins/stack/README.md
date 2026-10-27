# Stack Plugin

`@8f4e/editor-plugin-stack` owns the `stack` directive's arguments, layout, derived data, and rendering.
The default editor installs it; editor-core installs no plugins automatically.

```ts
import { createStackPlugin } from '@8f4e/editor-plugin-stack';

const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const plugin = createStackPlugin({ prefersReducedMotion: () => motionPreference.matches });
```

Pass the plugin in the editor's `plugins` array. Core retains generic comment parsing, block layout, memory resolution,
and drawing hooks. Feature data lives in a WeakMap created by each installation and never becomes a field in core state.

```txt
; @stack
```

Stack also accepts `@s` and uses compiler stack analysis for module and function blocks.

The browser host supplies `prefersReducedMotion: () => boolean` to the factory. The plugin reads it when drawing; it does not access browser globals.

Cleanup unregisters the directive and drawer. Omit the plugin to remove its behavior and layout space.

```sh
npx nx run @8f4e/editor-plugin-stack:build
npx nx run @8f4e/editor-plugin-stack:test
npx nx run @8f4e/editor-plugin-stack:typecheck
npx nx run @8f4e/editor-plugin-stack:test:screenshot
```
