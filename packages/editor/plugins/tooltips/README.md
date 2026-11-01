# Tooltips Plugin

`@8f4e/editor-plugin-tooltips` adds documentation beside the selected code line, including compiler stack analysis,
module execution order, and live memory values. It owns the content, layout, entrance animation, and drawing.

```ts
import { tooltipsPlugin } from '@8f4e/editor-plugin-tooltips';

const editor = await initEditor(canvas, { ...options, plugins: [tooltipsPlugin] });
```

The default editor includes this plugin. Core installs no plugins by default. The `codeLineSelection` feature flag
controls whether selected-line tooltips are visible.

Each installation keeps its tooltip state private and registers a code-block overlay. It subscribes to selection,
source, compiler, grid, and sprite changes. Live values are read from the current runtime memory during drawing.
Disposal removes its subscriptions, sprite-reload listener, and overlay contribution.

The plugin uses the existing tooltip font and fill entries in the sprite palette.

```bash
npx nx run @8f4e/editor-plugin-tooltips:build
npx nx run @8f4e/editor-plugin-tooltips:test
npx nx run @8f4e/editor-plugin-tooltips:typecheck
npx nx run @8f4e/editor-plugin-tooltips:test:screenshot
```
