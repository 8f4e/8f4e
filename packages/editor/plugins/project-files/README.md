# Project Files

`@8f4e/editor-plugin-project-files` provides two alternative plugins that serialize the current root project as
`.8f4e` source, including nested groups. Both receive the editor's input element.

## File access

```ts
import { createProjectFilesPlugin } from '@8f4e/editor-plugin-project-files';

const plugins = [createProjectFilesPlugin({ inputTarget: canvas })];
```

The default editor installs this plugin after core's first render. It owns Open From Disk (`importProject`),
Save (`saveProject`, Cmd/Ctrl+S) and Export Project (`exportProject`, or Save As).

Open reads and parses the selected file before dispatching `loadProject` and associating the file handle.
The first Save without an association chooses a destination. Later saves reuse the associated handle, requesting
write permission when necessary. Export Project always chooses a destination and adopts it for later saves.
Cancellation and failed reads or writes preserve the previous association.

The plugin keeps its handle private to each installation and clears it on `loadProject` and disposal; undo and
redo retain it. Pickers and permission requests start in the user gesture. Writes run in command order and
overlapping saves reuse a pending destination. Accepted writes retain their captured source and destination
after project replacement or disposal, but cannot associate an old destination with a replacement project.

After file selection, Open contributes a `project-file` loading indicator with the message `Loading project...`
while reading, parsing and installing source. A pending Open cannot load a project after disposal.

## One-shot export

```ts
import { createProjectExportPlugin } from '@8f4e/editor-plugin-project-files/export';

const plugins = [createProjectExportPlugin({ inputTarget: canvas })];
```

The gallery editor installs only this plugin. Its Export Project menu action and Cmd/Ctrl+S shortcut both
choose a fresh destination every time. It does not install Open From Disk, handle `saveProject` or associate
projects with files. The landing editor installs neither plugin.

Both plugins use the configured export filename, and download a file when the Save picker is unavailable.
Full file access uses a file input when the Open picker is unavailable; uploads have no writable association.
Serialization and I/O errors appear in the editor console.

Validate with Nx `build`, `test` and `typecheck` for `@8f4e/editor-plugin-project-files`. Browser coverage lives
in `@8f4e/editor-default:test:screenshot` and `@8f4e/8f4e-website:test:browser`.
