# Project Import Feature

## Purpose

Handles loading compiler-owned `ProjectObjectModel` values into the editor from persistent storage, `.8f4e` file
uploads, direct project URLs, and default templates.

## Key Behaviors

- **Initial Load**: Loads project from storage or falls back to default on editor startup
- **File Import**: Handles importing project files through file picker
- **URL Import**: Loads projects by project URL
- **Default Project**: Provides fallback when no saved project exists
- **State Initialization**: Sets up `initialProjectState` for the editor

## Import Sources

### Storage Load
- Loads most recent saved project from persistent storage
- Triggered automatically on editor initialization

### File Import
- User-triggered file picker for `.8f4e` project files
- Parses `.8f4e` text into the project structure

### URL Import
- Loads projects by shareable URL identifier
- Uses the `getProject` callback for remote fetching

### Default Template
- Fallback when no saved project or specified import
- Provides starting point for new projects

## Events & Callbacks

### Events Listened To

- `new` - Starts an empty project and clears the file association
- `loadProject` - Loads a project object into editor state; history snapshots pass `preserveFileAssociation: true`
- `importProject` - Imports a `.8f4e` project from disk
- `loadProjectByUrl` - Loads and parses a `.8f4e` project from a URL

### Callbacks Used

- `state.callbacks.loadSession()` - Retrieves the locally saved project object
- `state.callbacks.importProject()` - Opens a file picker and parses `.8f4e` text; returns `null` on cancellation
- `state.callbacks.projectLoaded(project)` - Notifies the host before an unrelated project replaces the current one
- `state.callbacks.getProject(url)` - Fetches `.8f4e` text by URL

The default composition associates successfully opened files with their browser handles through `projectLoaded`.
Other replacements (including new projects, URLs/examples, and restored sessions) clear that association. Undo and
redo preserve it. Cancelled or failed disk imports leave both the current project and file association unchanged.

### State Touched

- `state.initialProjectState` - Initial project loaded on startup
- `state.codeBlockRendering` - Populated from loaded code blocks
- `state.binaryAssets` - Runtime asset metadata populated by the editor environment binary-assets plugin when binary asset config is active

## Integration Points

- **Project Export**: Imported projects use the same `ProjectObjectModel` exported by editor persistence
- **Program Compiler**: Loaded code blocks trigger program compilation if enabled
- **Edit History**: Project loads reset history stacks

## Project Loading Flow

1. Attempt to load from storage (if available)
2. If storage load fails, use default project
3. Initialize code blocks from the project structure
4. Trigger initial compilation if enabled

## References

- Object model: `ProjectObjectModel` in `@8f4e/language-spec`
- Counterpart: `@8f4e/editor-plugin-project-export` for Save/Export; shared serialization lives in `pureHelpers/projectSerialization`

## Notes & Limitations

- Import callbacks are optional (graceful degradation to defaults)
- Project validation is minimal beyond `.8f4e` parser checks
- Binary asset fetching and memory loading are handled by the lazy editor environment binary-assets plugin, triggered by `@config bin...` values
