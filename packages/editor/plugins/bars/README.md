# Bars Plugin

`@8f4e/editor-plugin-bars` owns the `bars` directive's arguments, layout, derived data, and rendering.
The default editor installs it; editor-core installs no plugins automatically.

```ts
import { barsPlugin } from '@8f4e/editor-plugin-bars';

const plugin = barsPlugin;
```

Pass the plugin in the editor's `plugins` array. Core retains generic comment parsing, block layout, memory resolution,
and drawing hooks. Feature data lives in a WeakMap created by each installation and never becomes a field in core state.

```txt
; @bars <pointerSource> <elementCount> [min max]
```

References use the public editor-state memory helpers, including memory exposed by project groups.

Cleanup releases layout subscriptions/contributions and the drawer. Omit the plugin to remove its behavior and layout space.

```sh
npx nx run @8f4e/editor-plugin-bars:build
npx nx run @8f4e/editor-plugin-bars:test
npx nx run @8f4e/editor-plugin-bars:typecheck
npx nx run @8f4e/editor-plugin-bars:test:screenshot
```
