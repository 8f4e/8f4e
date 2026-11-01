# Editor File Session

`@8f4e/editor-file-session` shares the current file handle between one editor's Open and Save plugins.
Create it with `createProjectFileSession()`, install its `plugin` before project loaders, and inject the same
session into the desired file plugins. Each editor gets its own instance.

The session contains `handle` and its lifecycle plugin. Open assigns `fileSession.handle` after reading, parsing,
and loading a file. Save reuses the handle and updates it after a successful Save As. The session clears it on
`loadProject` (including New Project and URL/session loads) and disposal. Undo/redo retain the association.

Open owns reading and parsing. Save owns serialization, filenames, browser writes, permissions, download fallbacks,
pending destinations, write ordering, and stale-completion handling. Core retains generic project loading and history.

Run Nx `build` and `typecheck` for this package. The project-open suite covers the composed session and both plugins,
and the product website's browser suite covers Save and Export without Open.
