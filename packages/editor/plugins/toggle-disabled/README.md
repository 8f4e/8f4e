# Toggle Disabled Plugin

`@8f4e/editor-plugin-toggle-disabled` contributes Enable/Disable to the clicked block's context menu in edit mode.
It adds or removes the authored `@disabled` directive through core's project transactions. The action is unavailable
for read-only blocks and structural groups, and works independently of selection.

The default editor loads `toggleDisabledPlugin` after the first render. Other compositions can omit it.
Core still interprets `@disabled` in manually edited or loaded source, including its compilation and presentation
effects. The plugin owns only the menu action and unregisters it and its listener on disposal.
