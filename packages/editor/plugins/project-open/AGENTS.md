# Project Open Plugin

- Own picking, reading and parsing project files. Dispatch `loadProject` after successful parsing, then assign
  the opened handle to the shared file session. Cancellation and parse failure preserve the current project
  and association.
- Track loading after file selection. Ignore pending reads after disposal. Project-save owns writes.
