# Plot Plugin

`@8f4e/editor-plugin-plot` owns the `plot` directive's arguments, layout, derived data, and rendering.
Install the plugin through the editor's plugin registry; editor-core installs no plugins automatically.

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
The shared `prepareBuffer` helper prepares the source, sample type, and literal/live count. Drawing uses its shared
typed-index and count readers; trace geometry and range overrides remain local.
When the element count comes from runtime memory, a zero or negative count draws no samples. Layout space remains
allocated by the directive so subsequent source lines stay in place.

Cleanup releases layout subscriptions/contributions and the drawer. Omit the plugin to remove its behavior and layout space.

```sh
npx nx run @8f4e/editor-plugin-plot:build
npx nx run @8f4e/editor-plugin-plot:test
npx nx run @8f4e/editor-plugin-plot:typecheck
npx nx run @8f4e/editor-plugin-plot:test:screenshot
```
