# Button Plugin

`@8f4e/editor-plugin-button` provides momentary buttons declared with `; @button <memoryAddress> [offValue] [onValue]`.
The values default to `0` and `1`. Pressing a button writes its on value; releasing the pointer writes its off value.

```ts
import { buttonPlugin } from '@8f4e/editor-plugin-button';

const editor = await initEditor(canvas, { ...options, plugins: [buttonPlugin] });
```

The default editor includes this plugin. It owns argument handling, memory resolution, geometry, drawing, and
press/release listeners. Each installation stores its buttons in a private `buttonsByBlock` map and tracks its
pressed button. Core provides generic directive parsing, block layout, memory resolution, and drawer registration.
The plugin registers `layoutCallbacks` for geometry updates; its button data stays private.

Memory references can point to module declarations or exposed group memory through the existing public memory API.
Integer and float values are drawn from their respective memory views. Disposal releases a held button and removes
its listeners and contributions.

The button uses the existing `switchBackground`, `controlKnob`, and `fontControlKnob` palette entries.
Extensible palette contributions remain tracked in [TODO 507](../../../../docs/todos/507-design-plugin-fill-color-contributions.md).

```bash
npx nx run @8f4e/editor-plugin-button:build
npx nx run @8f4e/editor-plugin-button:test
npx nx run @8f4e/editor-plugin-button:typecheck
npx nx run @8f4e/editor-plugin-button:test:screenshot
```
