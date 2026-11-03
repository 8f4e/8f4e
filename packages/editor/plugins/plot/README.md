# Plot Plugin

`@8f4e/editor-plugin-plot` owns the `plot` directive's arguments, layout, derived data, and rendering.
The default editor installs it; editor-core installs no plugins automatically.

```ts
import { plotPlugin } from '@8f4e/editor-plugin-plot';

const plugin = plotPlugin;
```

Pass the plugin in the editor's `plugins` array. Core retains generic comment parsing, block layout, memory resolution,
and drawing hooks. Feature data lives in a WeakMap created by each installation and never becomes a field in core state.

```txt
; @plot <pointerSource> <elementCount> [min max]
```

References use the public editor-state memory helpers, including memory exposed by project groups.
When the element count comes from runtime memory, a zero or negative count draws no samples. Layout space remains
allocated by the directive so subsequent source lines stay in place.

Cleanup releases layout subscriptions/contributions and the drawer. Omit the plugin to remove its behavior and layout space.

```sh
npx nx run @8f4e/editor-plugin-plot:build
npx nx run @8f4e/editor-plugin-plot:test
npx nx run @8f4e/editor-plugin-plot:typecheck
npx nx run @8f4e/editor-plugin-plot:test:screenshot
```
