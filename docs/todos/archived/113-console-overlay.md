---
title: 'TODO: Console Overlay'
priority: Medium
effort: 3-5 days
created: 2025-12-03
status: Completed
completed: 2025-12-04
---

# TODO: Console Overlay

## Problem Description

Currently, the editor lacks a way to capture and display internal logging from editor-state effects and operations. While `console.log` statements exist throughout the codebase (in runtime.ts, compiler.ts, loader.ts, etc.), these logs are only visible in the browser DevTools console, making it difficult to monitor editor activity during development and debugging.

**Current State**: Internal editor logs go directly to the browser console via native `console.log`, `console.warn`, and `console.error`.

**Why this is a problem**: 
- No in-editor visibility of internal logging
- Difficult to monitor editor behavior without opening DevTools
- No way to display relevant logs to users in production
- Missing unified logging infrastructure within editor-state

**Impact**: Reduced debugging efficiency, lack of runtime visibility, and no centralized logging system for editor internals.

## Proposed Solution

**High-level approach**: Create an internal logging utility in `impureHelpers` that captures log messages and stores them in state, then add a console overlay drawer (similar to the info overlay) that renders these logs on the right side of the screen.

**Key changes required**:
- Add console state to State interface with LogMessage array
- Create internal logger utility functions (log, warn, error, info) in `impureHelpers/logger.ts`
- Implement serialization for objects, arrays, and complex types
- Create console overlay drawer to render logs on screen
- Add `consoleOverlay` feature flag (default: false)
- Integrate drawer into render loop
- Update existing effects to use the new logger

**Architecture**:
- Logger is internal-only (not exported from editor-state package)
- Logs stored in state with circular buffer (max 100 entries)
- Simple serialization handles primitives, objects, arrays, errors
- Drawer positioned on right side of viewport
- Feature flag controls visibility

## Implementation Plan

### Step 1: Add Console State Types
- Add `LogMessage` interface to `packages/editor/packages/editor-state/src/types.ts`
- Add `console` property to State interface with logs array and maxLogs limit
- **Expected outcome**: Type-safe console state structure
- **Dependencies**: None

```typescript
export interface LogMessage {
  level: 'log' | 'warn' | 'error' | 'info';
  message: string;
  timestamp: number;
}

export interface State {
  // ... existing properties
  console: {
    logs: LogMessage[];
    maxLogs: number;
  }
}
```

### Step 2: Initialize Console State
- Update `packages/editor/packages/editor-state/src/pureHelpers/state/createDefaultState.ts`
- Initialize console state with empty logs array and maxLogs = 100
- **Expected outcome**: Console state initialized in default state
- **Dependencies**: Step 1

### Step 3: Create Internal Logger Utility
- Create `packages/editor/packages/editor-state/src/impureHelpers/logger.ts`
- Implement `serializeValue()` function for converting any type to string
- Implement `log()`, `warn()`, `error()`, `info()` functions
- Implement circular buffer logic (shift oldest when exceeding maxLogs)
- Handle primitives, objects, arrays, errors, functions
- **Expected outcome**: Working internal logger that mutates state
- **Dependencies**: Step 2

**Serialization strategy**:
- Primitives (string, number, boolean, null, undefined): Convert to string
- Arrays: Inline if ≤3 items, otherwise show length
- Objects: Inline if ≤3 keys, otherwise show key count
- Errors: Show name and message
- Functions: Show function name

### Step 4: Add Feature Flag
- Add `consoleOverlay: boolean` to FeatureFlags interface in `packages/editor/packages/editor-state/src/types.ts`
- Update `packages/editor/src/config/featureFlags.ts` with default value (false)
- Update `validateFeatureFlags` to include new flag
- **Expected outcome**: Feature flag available for configuration
- **Dependencies**: None

### Step 5: Create Console Overlay Drawer
- Create `packages/editor/packages/web-ui/src/drawers/consoleOverlay.ts`
- Implement rendering logic using glugglugglug engine
- Position overlay on right side of viewport
- Calculate visible logs based on screen height
- Truncate long messages to fit screen width
- Draw background and text for each log entry
- Support different background colors for log levels (error, warn, etc.)
- **Expected outcome**: Functional drawer that renders console logs
- **Dependencies**: Step 1, Step 2

**Visual layout**:
- Position: Right side of screen
- Width: 60 characters + padding
- Background: Use 'moduleBackground' sprite (or level-specific colors)
- Text: Monospace font from sprite sheets
- Max visible logs: Screen height / character height - 2

### Step 6: Integrate into Render Loop
- Export drawer from `packages/editor/packages/web-ui/src/drawers/index.ts`
- Import in `packages/editor/packages/web-ui/src/index.ts`
- Add conditional rendering based on `state.featureFlags.consoleOverlay`
- Position after info overlay, before dialog and context menu
- **Expected outcome**: Console overlay renders when feature flag is enabled
- **Dependencies**: Step 4, Step 5

### Step 7: Update Effects to Use Logger
- Update `packages/editor/packages/editor-state/src/effects/runtime.ts` to use logger
- Update `packages/editor/packages/editor-state/src/effects/compiler.ts` to use logger
- Update `packages/editor/packages/editor-state/src/effects/projectImport.ts` (loader) to use logger
- Update `packages/editor/packages/editor-state/src/effects/editorSettings.ts` to use logger
- Replace relevant `console.log` calls with `log(state, ...)` calls
- Keep some native console.error calls for critical errors
- **Expected outcome**: Effects use internal logger, logs appear in overlay
- **Dependencies**: Step 3

### Step 8: Testing and Documentation
- Test logger with various data types (primitives, objects, arrays, errors)
- Test circular buffer behavior (old logs removed)
- Test feature flag on/off behavior
- Test rendering with many logs (performance)
- Verify truncation of long messages
- Update `docs/feature-flags.md` with consoleOverlay documentation
- **Expected outcome**: Tested and documented feature
- **Dependencies**: All previous steps

## Success Criteria

- [ ] LogMessage interface and console state added to types
- [ ] Console state initialized in createDefaultState
- [ ] Internal logger utility created in impureHelpers/logger.ts
- [ ] Logger handles primitives, objects, arrays, errors, functions
- [ ] Circular buffer prevents unbounded memory growth
- [ ] consoleOverlay feature flag added and working
- [ ] Console overlay drawer renders logs on right side of screen
- [ ] Drawer integrates into render loop
- [ ] Effects (runtime, compiler, loader) use internal logger
- [ ] Feature flag controls visibility (default: false)
- [ ] Long messages truncated to fit screen
- [ ] Documentation updated in docs/feature-flags.md
- [ ] All tests passing

## Affected Components

**New Files**:
- `packages/editor/packages/editor-state/src/impureHelpers/logger.ts` - Internal logger utility
- `packages/editor/packages/web-ui/src/drawers/consoleOverlay.ts` - Console overlay drawer

**Modified Files**:
- `packages/editor/packages/editor-state/src/types.ts` - Add LogMessage interface, console state, consoleOverlay flag
- `packages/editor/packages/editor-state/src/pureHelpers/state/createDefaultState.ts` - Initialize console state
- `packages/editor/src/config/featureFlags.ts` - Add consoleOverlay flag default
- `packages/editor/packages/web-ui/src/drawers/index.ts` - Export consoleOverlay drawer
- `packages/editor/packages/web-ui/src/index.ts` - Integrate drawer into render loop
- `packages/editor/packages/editor-state/src/effects/runtime.ts` - Use internal logger
- `packages/editor/packages/editor-state/src/effects/compiler.ts` - Use internal logger
- `packages/editor/packages/editor-state/src/effects/projectImport.ts` - Use internal logger
- `packages/editor/packages/editor-state/src/effects/editorSettings.ts` - Use internal logger
- `docs/feature-flags.md` - Document consoleOverlay feature flag

## Risks & Considerations

- **Memory usage**: Circular buffer with 100 max logs should prevent unbounded growth
- **Performance**: Rendering many logs could impact frame rate (limit visible logs to screen height)
- **Screen real estate**: Overlay takes up right side of screen (controlled by feature flag)
- **Serialization depth**: Deep object nesting handled by showing summaries, not full trees
- **Log spam**: High-frequency logging could fill buffer quickly (be selective about what to log)
- **Testing complexity**: Need to test various data types and edge cases

## Related Items

- **Related**: Info overlay (`packages/editor/packages/web-ui/src/drawers/infoOverlay.ts`) - Similar pattern
- **Related**: Feature flags system (`packages/editor/src/config/featureFlags.ts`)
- **Blocks**: None
- **Depends on**: Existing drawer infrastructure and feature flags system

## References

- [Info Overlay Implementation](packages/editor/packages/web-ui/src/drawers/infoOverlay.ts)
- [Feature Flags Documentation](docs/feature-flags.md)
- [Feature Flags Config](packages/editor/src/config/featureFlags.ts)
- [Existing Console Usage](https://github.com/8f4e/8f4e/search?q=console.log&type=code)

## Visual Layout

```
┌─────────────────────────────────────────────────────────────┐
│                                          Console Logs Panel │
│                                  [12:34:56] Starting build  │
│                                  [12:34:57] Build complete  │
│                                  [12:34:58] Runtime loaded  │
│                                                             │
│                 Code Editor Area                            │
│                                                             │
│                                                             │
│                                                             │
│ Info Overlay (bottom-left)                                  │
│ Runtime: WebWorkerLogicRuntime                              │
│ FPS: 60                                                     │
└─────────────────────────────────────────────────────────────┘
```

## Notes

- Logger is internal to editor-state package only (not exported)
- Native console.log still works for development debugging in DevTools
- Feature flag defaults to false to avoid clutter in production
- Serialization keeps output concise and readable
- Consider adding keyboard shortcut to toggle overlay (e.g., F2)
- Future enhancement: Click to expand objects, color coding by level
