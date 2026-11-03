# Code rendering plugin

`@8f4e/editor-plugin-code-rendering` draws source text inside code blocks, including notes, syntax highlighting,
line numbers, expanded tabs, folded placeholders, disabled colors, and rows reserved by layout contributions.
Both default and minimal editors install it eagerly.

```ts
import initEditor from '@8f4e/editor-core';
import { codeRenderingPlugin } from '@8f4e/editor-plugin-code-rendering';

const editor = await initEditor(canvas, { plugins: [codeRenderingPlugin] });
```

Each installation prepares its own sprite cells after `codeBlockLayoutsChanged` and draws those cached rows through
`drawers.registerCodeBlockContentDrawer`. Highlighting and glyph resolution happen outside the frame loop.
The plugin removes its listener, drawer, and cached data when disposed. It needs no browser resources.

Core owns source/display row mappings, block dimensions, gaps, tab geometry, cursor placement, and hit testing.
Web-ui owns the generic packed sprite-cell format and drawing primitives. The content drawer runs after block
backgrounds and highlights, before shape declarations, the cursor, diagnostics, other drawers, and overlays.

Run `npx nx run @8f4e/editor-plugin-code-rendering:build|test|typecheck` and
`npx nx run @8f4e/editor-plugin-code-rendering:test:screenshot`.
