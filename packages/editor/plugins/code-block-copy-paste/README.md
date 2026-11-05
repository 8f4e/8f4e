# Code-block copy and paste

`@8f4e/editor-plugin-code-block-copy-paste` contributes Copy Block and Paste Code Block menu actions. The default and minimal compositions load it in their deferred plugin set.

```ts
import { createCodeBlockCopyPastePlugin } from '@8f4e/editor-plugin-code-block-copy-paste';

const plugin = createCodeBlockCopyPastePlugin({
 readClipboardText: () => navigator.clipboard.readText(),
 writeClipboardText: text => navigator.clipboard.writeText(text),
});
```

Copy writes ordinary block source as plain text. A nested project group is written as a JSON array of serialized source blocks, preserving its complete child tree and entry tables. JSON source batches also carry relative coordinates and optional entry membership; plain module source uses the main entry.

Paste is available in edit mode. It inserts sources at the menu location and updates only `@pos` directives. Declaration names, project-group names, visual `@group` membership, and references are preserved exactly. Names are never numbered and there is no paste-transform hook. Core assigns fresh editor identities independently of source names.

Each feature owns its browser dependencies: this plugin owns block copy/paste, grouping receives its own clipboard writer, and keyboard-editing handles native text paste at the caret. There is no centralized clipboard manager. This plugin removes its menu items and event listeners on disposal.

Verify with `npx nx run @8f4e/editor-plugin-code-block-copy-paste:build|test|typecheck`.
