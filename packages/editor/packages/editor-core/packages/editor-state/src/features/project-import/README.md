# Project Import Feature

Loads compiler-owned `ProjectObjectModel` values and handles disk import. Core has no session restoration, storage,
or project URL fetching logic. Those features belong to their optional plugins.

## Events

- `new`: load the empty project and clear the file association.
- `loadProject({ project })`: replace the current project. History passes `preserveFileAssociation: true` for undo/redo.
- `importProject`: open a `.8f4e` file through the host callback.

The editor accepts `initialProject` at initialization, loads it (or the empty project) after resizing, and then emits
`init`. Plugins may use that generic hook and `loadProject` to replace initial content.

## Host Callbacks

- `importProject()`: return a parsed project or `null` when the picker is cancelled.
- `projectLoaded(project)`: notify the host before an unrelated replacement; excluded for undo/redo.

The default host shares file associations between Open, Save, and Export. New projects, URL-loaded projects, and
restored sessions use `loadProject`, clearing that association. Cancelled/failed disk imports leave it intact.

Project replacement sets `state.initialProjectState`; block effects populate the project and compilation follows
when enabled. Shared serialization lives under `pureHelpers/projectSerialization`. Session autosaving belongs to
`@8f4e/editor-plugin-session-persistence`, and URL loading to `@8f4e/editor-plugin-project-url-loader`.
