# Code rendering plugin

`@8f4e/editor-plugin-code-rendering` draws source text inside code blocks, including notes, syntax highlighting,
line numbers, nested block backgrounds, expanded tabs, folded placeholders, disabled colors, and rows reserved by
layout contributions.
Install it before the first render so source text is visible immediately.

```ts
import initEditor from '@8f4e/editor-core';
import { codeRenderingPlugin } from '@8f4e/editor-plugin-code-rendering';

const editor = await initEditor(canvas, { plugins: [codeRenderingPlugin] });
```

Each installation prepares its own sprite cells and nested block highlight rectangles for the blocks supplied
by `codeBlockLayoutsChanged { project, codeBlocks }`. Only those blocks in the owning group have completed
source/display derivation, positions, and pending layout contributions;
other blocks can still be updating. Unaffected blocks retain their prepared cells. The per-editor cache uses weak block
keys so removed projects are not retained.
It registers one `drawers.registerCodeBlockDrawer` callback, drawing nested highlights, contributed text backgrounds,
the selected-line fill, and cached text in that order. Feature plugins register backgrounds with
`drawers.registerCodeBlockTextBackgroundDrawer`; code rendering invokes them through
`drawers.drawCodeBlockTextBackgrounds` inside its own drawer, so late installations still draw below text. Hosts register their base block background before this plugin. Block parsing, highlighting, palette-index resolution, and glyph resolution happen
outside the frame loop. Highlights cycle through three surface shades by nesting depth, clip at folded content, and
are suppressed for disabled blocks. The plugin removes its listener, drawer, and cached data when disposed.
It needs no browser resources.

Core owns source/display row mappings, block dimensions, gaps, tab geometry, cursor placement, and hit testing.
Web-ui owns the generic packed sprite-cell format and drawing primitives. Block drawers run in registration order;
later installations draw above this plugin. There are no separate block drawing phases.

Run `npx nx run @8f4e/editor-plugin-code-rendering:build|test|typecheck` and
`npx nx run @8f4e/editor-plugin-code-rendering:test:screenshot`.
