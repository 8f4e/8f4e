# Feature Flags Configuration Documentation

The feature flags system allows you to enable/disable specific editor functionality during editor instantiation.

## Available Feature Flags

- `contextMenu: boolean` - Enable/disable right-click context menu functionality
- `moduleDragging: boolean` - Enable/disable dragging and repositioning of code block modules
- `viewportDragging: boolean` - Enable/disable panning/scrolling of the editor viewport
- `editing: boolean` - Enable/disable all editing functionality (create, edit, delete, save)
- `modeOverlay: boolean` - Enable/disable the mode hint overlay at the top of the viewport
- `offscreenBlockArrows: boolean` - Enable/disable arrows that point toward off-screen code blocks

## Usage Examples

### Basic Usage - All Features Enabled (Default)

```typescript
import init from '@8f4e/editor-core';

const state = init(events, project, {});
// All features are enabled by default
```

### Disable Specific Features

```typescript
import init from '@8f4e/editor-core';

const state = init(events, project, {
  featureFlags: {
    contextMenu: false,      // Disable right-click context menu
    moduleDragging: false,   // Disable module dragging
    // Other features remain enabled
  }
});
```

### Disable All Editing

```typescript
import init from '@8f4e/editor-core';

const state = init(events, project, {
  featureFlags: {
    editing: false,          // Disable all editing functionality
    // All other features remain enabled (context menu, dragging, etc.)
  }
});
```

### View-Only Mode

```typescript
import init from '@8f4e/editor-core';

const state = init(events, project, {
  featureFlags: {
    editing: false,             // Disable all editing functionality
    contextMenu: false,         // Disable context menus
    moduleDragging: false,      // Disable module dragging
    // viewportDragging remains enabled for navigation
  }
});
```

### Complete View-Only Mode (No Interaction)

```typescript
import init from '@8f4e/editor-core';

const state = init(events, project, {
  featureFlags: {
    editing: false,             // Disable all editing functionality
    contextMenu: false,         // Disable context menus
    moduleDragging: false,      // Disable module dragging
    viewportDragging: false,    // Disable viewport panning
  }
});
```

### Clean Export Rendering

The screenshot plugin temporarily disables visual guide features such as `modeOverlay` and `offscreenBlockArrows`
through the state manager before rendering the capture frame, and restores their previous values afterward.

### Completely Locked Editor

```typescript
import init from '@8f4e/editor-core';

const state = init(events, project, {
  featureFlags: {
    contextMenu: false,
    moduleDragging: false,
    viewportDragging: false,
  }
});
```

## Security Considerations

- Feature flags are immutable after editor instantiation for security
- Flags should be configured during setup phase and then locked
- Disabling features provides graceful degradation - no errors occur when disabled features are accessed

## Type Safety

The feature flags system is fully type-safe with TypeScript:

```typescript
import { FeatureFlagsConfig } from '@8f4e/editor-core';

const config: FeatureFlagsConfig = {
  contextMenu: false,
  // TypeScript will provide autocomplete and type checking
};
```
