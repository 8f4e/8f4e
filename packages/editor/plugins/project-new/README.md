# Project New Plugin

`@8f4e/editor-plugin-project-new` owns the **New Project** menu item and the `new` action. Install
`newProjectPlugin` in compositions that offer blank-project creation. The menu contribution appears in edit mode
and closes when activated.

The action loads the canonical empty project through core's generic `loadProject` operation. Project replacement,
history reset and source preparation follow the same path used when loading any other project. The plugin has no
browser, file-access or other plugin dependencies.

The default editor installs this plugin after its first render. Gallery and landing compositions omit it.
Disposal removes both the menu contribution and the action handler.

Verify with `npx nx run @8f4e/editor-plugin-project-new:build|test|typecheck`.
