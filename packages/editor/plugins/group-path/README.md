# Group Path Plugin

`createGroupPathPlugin({ topRow })` registers a read-only canvas overlay that shows the current project group and its
ancestors. Each level adds an indented row like `└─ group audio`. The current group is highlighted, and the tree
is hidden at the project root. `topRow` defaults to the first row. The default editor sets it to the second row
when the mode hint is enabled.

The default editor loads the plugin after the first render. The plugin reads the active group path from core state and
refreshes it on navigation or project changes. It respects `canvasOverlays` and removes its drawer and subscriptions
when disposed.
