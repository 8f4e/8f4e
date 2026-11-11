# Watch Plugin

`@8f4e/editor-plugin-watch` owns the `watch` directive's arguments, layout, derived data, and rendering.
For lazy installation, match `@watch` or `@w` in the current project level with `view` scope.
Editor-core installs no plugins automatically.

```ts
import { createWatchPlugin } from '@8f4e/editor-plugin-watch';

const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
const plugin = createWatchPlugin({ prefersReducedMotion: () => motionPreference.matches });
```

Pass the plugin in the editor's `plugins` array. Core retains generic comment parsing, block layout, memory resolution,
and drawing hooks. Feature data lives in a WeakMap created by each installation and never becomes a field in core state.

```txt
; @watch <memoryExpression>
```

Watch also accepts `@w`. With no target name, an inline watch reads the compiled memory declaration on its source line,
including anonymous declarations. Format and access modifiers such as `0x` or `*[1]` can be used without a name.
Fixed references work inline and by name: `@watch buffer` shows the fixed target address, while `@watch *buffer`
shows its current value. `@watch *buffer[1]` reads the second target element. A reference has no slot for `&buffer`.
Fixed-reference accesses are prepared during layout and retained until layout or compilation changes; drawing reads
their live values without repeating target lookup.
The plugin parses `0b`/`0x` display prefixes and retains the compiler parser's structured `end()` targets until layout.
`@watch end(buffer)` shows the exclusive logical boundary, and `@watch end(*connection)` shows a fixed connection's
target boundary. Module and indexed forms such as `end(source:)` and `end(source:0)` use the same selectors as the
compiler. Inline `end()` and `end(*)` select the declaration or fixed target on the directive's source line.
Formatting choices remain private to watch.

Dereferenced watches such as `; @watch *pointer` follow the current pointer target and its value on every rendered frame,
without requiring a selection change. Indexed and formatted forms such as `; @watch 0x*pointer[1]` update the same way.
Named pointer declarations, element indices, and access options are prepared during layout. Drawing reads the live
pointer through shared numeric-read primitives, without parsing, resolving declarations, or constructing access
objects. The shared layer selects storage and applies element offsets; watch retains radix and precision formatting.

For debugger inspection, `@watch end(*pointer)` can also follow a mutable pointer when it points to the first element
of a known declaration. This live lookup is a watch feature. Compiler expressions require a fixed reference for
`end(*connection)` because mutable pointers do not retain a compile-time buffer boundary.

The browser host supplies `prefersReducedMotion: () => boolean` to the factory. The plugin reads it when drawing; it does not access browser globals.

Cleanup releases layout subscriptions/contributions and the drawer. Omit the plugin to remove its behavior and layout space.
The block drawer runs in registration order with other code-block drawers, including plugins installed lazily.

```sh
npx nx run @8f4e/editor-plugin-watch:build
npx nx run @8f4e/editor-plugin-watch:test
npx nx run @8f4e/editor-plugin-watch:typecheck
npx nx run @8f4e/editor-plugin-watch:test:screenshot
```
