# Code rendering plugin

`@8f4e/editor-plugin-code-rendering` draws source text inside code blocks, including notes, syntax highlighting,
line numbers, nested block backgrounds, expanded tabs, folded placeholders, disabled colors, and rows reserved by
layout contributions.
Both default and minimal editors install it eagerly.

```ts
import initEditor from '@8f4e/editor-core';
import { codeRenderingPlugin } from '@8f4e/editor-plugin-code-rendering';

const editor = await initEditor(canvas, { plugins: [codeRenderingPlugin] });
```

Each installation prepares its own sprite cells and nested block highlight rectangles after `codeBlockLayoutsChanged`.
It registers one `drawers.registerCodeBlockDrawer` callback, drawing nested highlights, the selected-line fill, and
cached text in that order. Hosts register their base block background before this plugin. Block parsing, highlighting, palette-index resolution, and glyph resolution happen
outside the frame loop. Highlights cycle through three surface shades by nesting depth, clip at folded content, and
are suppressed for disabled blocks. The plugin removes its listener, drawer, and cached data when disposed.
It needs no browser resources.

Core owns source/display row mappings, block dimensions, gaps, tab geometry, cursor placement, and hit testing.
Web-ui owns the generic packed sprite-cell format and drawing primitives. Block drawers run in registration order;
later installations draw above this plugin. There are no separate block drawing phases.

Run `npx nx run @8f4e/editor-plugin-code-rendering:build|test|typecheck` and
`npx nx run @8f4e/editor-plugin-code-rendering:test:screenshot`.
