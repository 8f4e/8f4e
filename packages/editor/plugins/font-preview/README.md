# Font preview

`@8f4e/editor-plugin-font-preview` cycles through sprite-generator's font catalog with **F18** (previous) and **F19**
(next), wrapping at either end. It works in view and edit modes and ignores modified or already handled keys.

```ts
import { createFontPreviewPlugin } from '@8f4e/editor-plugin-font-preview';

const plugin = createFontPreviewPlugin({ inputTarget: canvas });
```

The default editor imports and installs it on non-coarse-pointer browsers. The minimal editor omits it.

The selected font temporarily overrides the resolved `editorConfig.font`; web-ui loads the atlas and updates layout.
Previewing changes neither project source nor history, revision, session content, or exported files. The preview stays
active when source configuration is resolved again, including after edits. Loading another project clears it before
that project's configuration is applied. Disposing the plugin removes its listeners and restores the current
source-derived configuration through the generic `resolveEditorConfig` helper.
