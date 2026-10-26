# Editor Palette

Pure base palette resolution for the editor. This package has no browser, renderer, state, or plugin dependencies.

```ts
import { resolvePalette } from '@8f4e/editor-palette';

const palette = resolvePalette({ surface: '#1a0b24', ink: '#f6eff8', primary: '#d9a6ff' });
const fill = palette.colors.primaryDark1;
const wire = palette.rgba.strokeBase;
```

The configurable bases, fixed nine-shade ramps, generic materials, opacity variants, and validation rules are documented in
[the editor palette reference](../../docs/color-paths.md). Resolve a palette only when configuration changes or an
atlas is built. Drawers select already generated colors and sprite IDs.
