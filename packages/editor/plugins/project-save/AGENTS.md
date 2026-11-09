# Project Save Plugin

- Own text serialization, Save/Export actions, shortcuts, permissions and writes. Use the canonical project
  model from editor-state. Delegate block validation and template extraction to project-preparser.
- Begin browser pickers and permission requests in the user gesture. Serialize writes and keep destination
  bookkeeping in this plugin. Work accepted before project replacement may finish without changing the new
  project's file association.
