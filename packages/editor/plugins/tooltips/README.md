# Tooltips Plugin

`@8f4e/editor-plugin-tooltips` adds documentation beside the selected code line, including compiler stack analysis,
named call signatures, module execution order, and live memory values. It owns the content, layout, entrance animation, and drawing.

```ts
import { tooltipsPlugin } from '@8f4e/editor-plugin-tooltips';

const editor = await initEditor(canvas, { ...options, plugins: [tooltipsPlugin] });
```

The default editor includes this plugin. Core installs no plugins by default. The `codeLineSelection` feature flag
controls whether selected-line tooltips are visible.

Each installation keeps its tooltip state private and registers a code-block overlay. It subscribes to selection,
source, compiler, grid, and sprite changes. Live values are read from the current runtime memory during drawing.
Disposal removes its subscriptions, sprite-reload listener, and overlay contribution.

For `call` instructions, successful compilation supplies the selected overload's parameter names, types, and return
types. The tooltip uses the callable name from the selected source line and wraps long signatures between parameters,
keeping each name/type pair together. A pair wider than the normal wrap width expands the tooltip to fit. Parameters
expanded by `paramShape` appear in declaration order. Calls without resolved compiler metadata show the generic call
signature.

The plugin uses the existing tooltip font and fill entries in the sprite palette.

```bash
npx nx run @8f4e/editor-plugin-tooltips:build
npx nx run @8f4e/editor-plugin-tooltips:test
npx nx run @8f4e/editor-plugin-tooltips:typecheck
npx nx run @8f4e/editor-plugin-tooltips:test:screenshot
```
