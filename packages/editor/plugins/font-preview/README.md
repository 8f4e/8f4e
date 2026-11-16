# Font preview

`@8f4e/editor-plugin-font-preview` cycles through sprite-generator's font catalog with **F8** (previous) and **F9**
(next), wrapping at either end. It works in view and edit modes and ignores modified or already handled keys.

After a different font finishes loading, a small, nonmodal panel shows its display name, creator credits and
license for three seconds. Switching again replaces the panel and restarts the timer. This also covers changes
from project configuration. The panel wraps to the viewport and uses the newly loaded font and current palette.

```ts
import { createFontPreviewPlugin } from '@8f4e/editor-plugin-font-preview';

const plugin = createFontPreviewPlugin({ inputTarget: canvas });
```

The host chooses whether to install it based on keyboard and pointer capabilities. When the renderer has a custom
`defaultFont`, pass the same option to this factory so cycling starts from that font when source has no font directive.

The selected font temporarily overrides the resolved `editorConfig.font`; web-ui loads the atlas and updates layout.
Previewing changes neither project source nor history, revision, session content, or exported files. The preview stays
active when source configuration is resolved again, including after edits. Loading another project clears it before
that project's configuration is applied. Disposing the plugin removes its listeners and restores the current
source-derived configuration through the generic `resolveEditorConfig` helper.
Disposal also removes the credit panel, its timer and its subscriptions to web-ui's `fontChanged`, resize and grid
notifications. Attribution comes from sprite-generator's `FONT_CATALOG`, based on the bundled font notices.
