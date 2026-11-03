# Selection Animation

`@8f4e/editor-plugin-selection-animation` draws the four-character segment circling the selected code block in view
and edit modes. It follows the block's current dimensions and font grid, using the shared secondary palette color.

```ts
import initEditor from '@8f4e/editor-core';
import { selectionAnimationPlugin } from '@8f4e/editor-plugin-selection-animation';

const editor = await initEditor(canvas, { plugins: [selectionAnimationPlugin] });
```

Its entries are commented out in the default and minimal editors. Add it to a custom composition or uncomment those
entries to enable it. The plugin registers a foreground drawer and unregisters it on disposal. It uses the editor's
render loop without subscriptions, timers, or source changes.
Core retains selection state, selected corner colors, and line highlighting.

Verify with the package's Nx `build`, `test`, `typecheck`, and `test:screenshot` targets.
