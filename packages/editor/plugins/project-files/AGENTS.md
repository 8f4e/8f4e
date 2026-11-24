# Project Files Plugin

- Own picking, reading, parsing and writing project source files. Keep the current file handle private to the
  full file plugin. Dispatch `loadProject` after successfully parsing a file, then associate its handle.
- Clear the file association on project replacement and disposal; undo and redo retain it. Cancellation and
  failed imports or saves preserve the previous association. Track import loading and ignore pending reads
  after disposal.
- Share source formatting, filename selection, picking and writing with the export-only plugin. The export-only
  entry point has no remembered destination or project loading subscription.
- Begin pickers and permission requests in the user gesture. Full-plugin writes run in command order; accepted
  writes may finish after replacement without changing the replacement project's file association.
- Use the canonical project model from editor-state and delegate parsing, block validation and template extraction to
  project-preparser.
