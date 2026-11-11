# Meter Plugin

`@8f4e/editor-plugin-meter` owns the `meter` directive's arguments, layout, derived data, and rendering.
Install the plugin through the editor's plugin registry; editor-core installs no plugins automatically.

```ts
import { meterPlugin } from '@8f4e/editor-plugin-meter';

const plugin = meterPlugin;
```

Pass the plugin in the editor's `plugins` array. Core retains generic comment parsing, block layout, memory resolution,
and drawing hooks. Feature data lives in a WeakMap created by each installation and never becomes a field in core state.

```txt
; @meter <typedValueSource> [min max]
```

References use the public editor-state memory helpers, including memory exposed by project groups. With no arguments,
an inline meter reads the compiled memory declaration on its source line, including anonymous declarations.
Fixed references work by bare name (`@meter level`) and inline (`float& level &source:out ; @meter`), reading the
backing value without a runtime pointer slot.
The shared memory API prepares typed scalar or addressed reads and reads current values. The plugin owns range
overrides, amplitude normalization, segments, and the overload latch.

Cleanup releases layout subscriptions/contributions and the drawer. Omit the plugin to remove its behavior and layout space.

```sh
npx nx run @8f4e/editor-plugin-meter:build
npx nx run @8f4e/editor-plugin-meter:test
npx nx run @8f4e/editor-plugin-meter:typecheck
npx nx run @8f4e/editor-plugin-meter:test:screenshot
```
