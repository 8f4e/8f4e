# Piano Plugin

`@8f4e/editor-plugin-piano` provides a 24-key keyboard:

```txt
; @piano <pressedKeysListAddress> <pressedKeyCountAddress> [startingMidiNote]
```

Both memory arguments are addresses, including group-exposed addresses. The starting note defaults to zero.
The keyboard adds six rows below its directive and requests enough block width for its keys. Clicking a key toggles
that note in the runtime array and updates the active count. Runtime memory also drives the pressed-note highlights.

```ts
import { pianoPlugin } from '@8f4e/editor-plugin-piano';

const editor = await initEditor(canvas, { ...options, plugins: [pianoPlugin] });
```

The default editor includes this plugin. Each installation keeps keyboard geometry and resolved memory in a private
`keyboardsByBlock` map. The plugin registers its directive, layout callbacks, drawer, pointer listener, and
**Save piano values to code** context-menu action. Saving updates the notes and count together in their original
declarations, including when they belong to different modules. Sliders have their own save action.

Disposal removes all registrations. Generic syntax parsing, layout, memory resolution, and source editing remain in
core. The plugin uses the existing piano fill and pressed-note text colors; contributions remain deferred to
[TODO 507](../../../../docs/todos/507-design-plugin-fill-color-contributions.md).

```bash
npx nx run @8f4e/editor-plugin-piano:build
npx nx run @8f4e/editor-plugin-piano:test
npx nx run @8f4e/editor-plugin-piano:typecheck
npx nx run @8f4e/editor-plugin-piano:test:screenshot
```
