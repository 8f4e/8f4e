# Group Path Plugin

`createGroupPathPlugin({ topRow })` registers a read-only canvas overlay that shows the current project group and its
ancestors. Each level adds an indented row like `└─ group audio`. The current group is highlighted, and the tree
is hidden at the project root. `topRow` is a zero-based row offset from the top of the viewport and defaults to `0`.

The plugin reads the active group path from core state and refreshes it on navigation or project changes.
It respects `canvasOverlays` and removes its drawer and subscriptions when disposed.
