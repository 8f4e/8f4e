# Menu Feature

Core owns raw menu contents, contributions, requested world-coordinate anchors, the navigation stack, and action
or selector dispatch. Context-menu presentation belongs to `@8f4e/editor-plugin-context-menu`, including label
formatting, dimensions, clamping, hover state, hit testing, and drawing.

`contextmenu` opens the main or clicked-block menu and resets the stack. `openSubMenu { menu, payload }` pushes a
request; `menuBack` rebuilds its parent. Generators receive current state and caller-owned payloads and may return
items synchronously or asynchronously. Providers and generators unregister their own contributions.

Core forwards `contextMenuPointerMove` and completed `contextMenuPointerDown` events while an open menu consumes
pointer input before blocks or viewport dragging. The presenter sends `activateContextMenuItem { index, x, y }`,
using viewport coordinates, or `closeContextMenu` for an outside press. Core applies item close behavior before
running its action/selector. Disabled items and dividers do not activate.

`state.contextMenu` contains `open`, requested world coordinates `x`/`y`, raw `items`, and `menuStack`. It contains
no decorated labels or presentation geometry. Menu state is ephemeral and is not persisted.
