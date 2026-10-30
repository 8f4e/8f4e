# Editor File Session

`@8f4e/editor-file-session` provides the shared file destination and pending write state for one editor.
Create it with `createProjectFileSession()`, install its `plugin` before project loaders, and inject it into
Open/Save and Export. Each editor gets its own instance; core has no file service or handles.

The session holds only the current `handle`, pending destination, write queue, and generation used to prevent an
old write from adopting a destination after project replacement. `loadProject` (including New Project and URL/session
loads) and disposal clear the association; undo/redo retain it. Opening successfully assigns `fileSession.handle`.
The session takes no document or editor state and does not serialize projects, choose filenames, or log errors.

The separate `writeProjectFile({ fileSession, document, blob, fileName, saveAs })` browser helper writes an already
prepared Blob. It starts pickers and permissions in the user gesture, orders writes, and reuses a pending destination
for overlapping saves. Save As selects a new destination and adopts it for later saves. Browsers without a Save picker
download the Blob. Cancellation and failed writes retain the previous destination; accepted writes retain their
captured data and destination even after project replacement or disposal. File plugins own serialization and logging.

Run Nx `build` and `typecheck` for this package. The project-files suite covers the composed session and both feature
plugins, and the product website's browser suite covers Export without Open/Save.
