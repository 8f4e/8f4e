# Menu Feature

## Purpose

Manages context menu interactions in the editor: opening menus, highlighting options, and dispatching actions. Provides the event flow for contextual actions on code blocks and editor elements.

## Key Behaviors

- **Menu Opening**: Displays context menus at specified screen positions
- **Option Highlighting**: Tracks which menu option is highlighted by pointer movement
- **Action Dispatch**: Executes menu actions when options are selected
- **Pointer Handling**: An open menu consumes mouse presses and movement before code blocks or the viewport can react,
  including the click that closes the menu.
- **State Management**: Maintains menu state (open/closed, position, highlighted option)

## Events & Callbacks

### Events Listened To

- `contextmenu`: open the main or clicked-block menu
- `openSubMenu`: push a menu ID and payload onto the navigation stack
- `menuBack`: return to the previous request
- `mousemove` and `mousedown`: highlight and activate menu items

### State Touched

- `state.contextMenu.open`: whether the menu is displayed
- `state.contextMenu.x` and `.y`: world coordinates for menu placement
- `state.contextMenu.highlightedItem`: the highlighted item index
- `state.contextMenu.items` and `.itemWidth`: decorated menu items and measured width
- `state.contextMenu.menuStack`: the root request and its open submenus

## Integration Points

- **Code Blocks**: Context menus for block operations (duplicate, delete, etc.)
- **Viewport**: Menu positioning relative to viewport coordinates
- **UI Layer**: Menu rendering and interaction handling

## Menu Contents

Menu contents and available actions are built dynamically based on context. Built-in menu generators and plugin
submenus use the same `registerMenu(id, generator)` registry. A generator receives current state and its caller's
payload and may return items synchronously or asynchronously. The `openSubMenu` event carries `{ menu, payload }`;
core stores that request for Back navigation and renders the returned items. Plugins unregister their own menus.
The example-modules plugin owns module categories and loading. Core has no catalog callbacks or category-tree logic.

See `menus/` subdirectory for menu construction logic.

## Notes & Limitations

- Menu state is ephemeral (not persisted)
- Menu contents depend on context (selected block, viewport state, etc.)
- Position coordinates are in world/pixel space and translated by the viewport when drawn or hit-tested
