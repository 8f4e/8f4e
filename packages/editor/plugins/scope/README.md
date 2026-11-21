# Scope Plugin

`@8f4e/editor-plugin-scope` owns the `@scope` directive's value resolution, sampling, history, layout, and drawing.

```txt
; @scope <typedValueSource> <sampleRateHz> [min max]
; @scope level 30 -1 1
```

Value sources follow the same rules as `@meter`, including typed pointer reads, direct storage (`&name`), qualified
names, and group exposures. The range defaults to the source type's bounds. The editor reserves eight rows beneath
each valid directive even before compiling.

Use the compiler plugin's live memory getter to install the plugin:

```ts
import { createScopePlugin } from '@8f4e/editor-plugin-scope';

const plugin = createScopePlugin({ getMemory: compiler.getMemory });
```

Each displayed scope keeps its own bounded JavaScript array of sampled values, sized to the plot's width. The newest
value is at the right edge; histories survive layout changes to the same value binding. Sampling timers run
independently of drawing at the requested positive rate (up to 250 Hz), subject to browser timer accuracy.
Higher rates produce a source error: browser polling did not deliver meaningfully greater sample throughput above 250 Hz.
Scopes at the same rate share one timer per editor and sample together, each retaining its own history.
Sampling stops during recompilation, when a directive is removed or its project level is closed, and on disposal.
Unresolvable or non-finite values are not appended. History is neither allocated in nor loaded from WASM memory.

The default, gallery, and landing editor compositions load the plugin on demand when a scope directive appears in
the current project level. Removing the plugin releases its sampling timers, layout contribution, and drawer.

```sh
npx nx run @8f4e/editor-plugin-scope:build
npx nx run @8f4e/editor-plugin-scope:test
npx nx run @8f4e/editor-plugin-scope:typecheck
npx nx run @8f4e/editor-plugin-scope:test:screenshot
```
