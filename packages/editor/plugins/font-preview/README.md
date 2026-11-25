# Font preview

`@8f4e/editor-plugin-font-preview` uses **Cmd/Ctrl+-** for a smaller font and **Cmd/Ctrl++** (or **Cmd/Ctrl+=**)
for a larger font. It steps through sprite-generator's catalog by pixel-cell area and stops at the smallest and
largest fonts. With the editor focused, these shortcuts replace browser zoom in view and edit modes; unmodified
and already handled keys are left alone.

After a different font finishes loading, a small, nonmodal panel shows its display name, creator credits and
license for three seconds. Switching again replaces the panel and restarts the timer. This also covers changes
from project configuration. The panel includes all 256 CP437 character slots in a 16×16 grid, retaining blank slots
for missing glyphs. It uses the newly loaded font and current palette, wraps the credits, and scales down when
needed to keep the entire panel inside the viewport.

```ts
import { createFontPreviewPlugin } from '@8f4e/editor-plugin-font-preview';

const plugin = createFontPreviewPlugin({ inputTarget: canvas });
```

The host chooses whether to install it based on keyboard and pointer capabilities. When the renderer has a custom
`defaultFont`, pass the same option to this factory so previewing starts from that font when source has no font directive.

The selected font sets `state.appearance.fontOverride`; web-ui gives it precedence over the resolved `editorConfig.font`
when loading the atlas. Previewing changes neither project configuration nor source, history, revision, session content,
or exported files. The preview stays active when source configuration changes, including after edits. Loading another
project clears it after that project's configuration settles. Disposing the plugin clears the override so web-ui uses
the latest resolved font or the mount's default font again.
Disposal also removes the credit panel, its timer and its subscriptions to web-ui's `fontChanged` and resize
notifications. Font changes are prepared once after the new atlas and grid settle; the drawer consumes prepared
sprite positions, sizes and palette indices. Attribution comes from sprite-generator's `FONT_CATALOG`, based on
the bundled font notices.
