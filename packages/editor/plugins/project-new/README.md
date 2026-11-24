# Project New Plugin

`@8f4e/editor-plugin-project-new` owns the **New Project** menu item. Install
`newProjectPlugin` in compositions that offer blank-project creation. The menu contribution appears in edit mode
and closes when activated.

The item directly invokes core's generic `loadProject` operation with the canonical empty project. Project replacement,
history reset and source preparation follow the same path used when loading any other project. The plugin has no
browser, file-access or other plugin dependencies.

The default editor installs this plugin after its first render. Gallery and landing compositions omit it.
Disposal removes the menu contribution.

Verify with `npx nx run @8f4e/editor-plugin-project-new:build|test|typecheck`.
