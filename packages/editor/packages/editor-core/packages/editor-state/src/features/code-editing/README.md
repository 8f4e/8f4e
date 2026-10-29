# Code Editing Feature

## Purpose

Handles low-level text editing operations within code blocks: caret movement, character insertion, deletion, and newline operations. Manages cursor position and line mapping through gap buffer calculations.

## Key Behaviors

- **Caret Movement**: Arrow key navigation (up, down, left, right) with line wrapping
- **Text Insertion**: Single character and multi-character text insertion at cursor position
- **Deletion**: Backspace operation with line merging
- **Newline**: Enter key handling with line splitting
- **Gap Calculations**: Computes cursor position adjustments based on line length and content

## Events & Callbacks

### Events Listened To

- `moveCaret` - Handles arrow key navigation with direction parameter
- `deleteBackward` - Backspace key handler
- `insertNewLine` - Enter key handler
- `insertText` - Text input handler with text payload

### State Touched

- `state.codeBlockRendering.selectedCodeBlock.code` - Array of code lines
- `state.codeBlockRendering.selectedCodeBlock.cursor.row` - Current cursor row (line number)
- `state.codeBlockRendering.selectedCodeBlock.cursor.col` - Current cursor column position
- `state.codeBlockRendering.selectedCodeBlock.lastUpdated` - Timestamp of last edit
- `state.editorMode` - Global editor mode (`view` or `edit`); source editing is allowed only in `edit` mode
- `state.featureFlags.codeLineSelection` - Enables caret movement within selected code blocks

## Integration Points

- **Code Blocks**: Works on the currently selected code block
- **Edit History**: Code changes trigger debounced history snapshots
- **Syntax Highlighting**: The web UI render projection uses note highlighting for notes and 8f4e highlighting for other blocks

## Notes & Limitations

- Text insertion, deletion, and newline operations require `state.editorMode === 'edit'`
- Caret movement checks `state.featureFlags.codeLineSelection` before executing; switching modes and loading projects preserve this flag
- `editor-mode` transitions currently toggle both flags when entering or leaving edit mode
- Editing requires a selected code block
- Gap calculations handle edge cases like line wrapping and cursor bounds
- Line and column indices are 0-based internally
