# Edit History Feature

## Purpose

Provides undo/redo functionality for code changes by maintaining snapshots of project state. Uses a debounced save mechanism to avoid excessive memory usage and provide smooth editing experience.

## Key Behaviors

- **Debounced Saves**: Code changes trigger a 1-second debounced save to history stack
- **Fixed Stack Size**: Maintains up to 10 undo states (older states are dropped)
- **Undo/Redo Operations**: Restores previous/next project snapshots
- **Project Serialization**: Uses serialized project format for snapshots (without compiled data)
- **Event-Driven**: Responds to code changes and undo/redo events

## Events & Callbacks

### Events Listened To

- `undo` - Restores previous project state
- `redo` - Restores next project state

### Events Dispatched

- `loadProject` - Triggered to load a historical snapshot

### State Subscriptions

- `codeBlockRendering.selectedCodeBlock.code` - Monitors code changes for history saves

### State Touched

- `state.historyStack` - Array of historical project states (max 10 entries)
- `state.redoStack` - Array of redo states (max 10 entries)
- `state.featureFlags.historyTracking` - Enable/disable flag for the feature

## Integration Points

- **Project Serialization**: Uses `serializeToProject()` to create snapshots
- **Project Import**: Uses `loadProject` event to restore snapshots
- **Code Editing**: Monitors code changes through state subscriptions

## History Semantics

- **On Code Change**: Debounces for 1 second, then saves current state to history stack
- **On Undo**: 
  - Saves current state to redo stack
  - Pops and loads previous state from history stack
  - Clears pending debounce timer
- **On Redo**:
  - Saves current state to history stack
  - Pops and loads next state from redo stack
  - Clears pending debounce timer

## Notes & Limitations

- History is limited to 10 entries in each direction
- Only tracks code changes in selected blocks
- Snapshots exclude compiled modules to reduce memory usage
- Debounce timer is cleared on undo/redo to avoid unexpected saves
- History is not persisted across sessions
