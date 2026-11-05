# Block authoring

- Own New Module/Function/Prototype/Note and Delete menu contributions, templates, random names, and action handlers.
- Dispatch generic `insertCodeBlock` for source insertion and call `deleteCodeBlocks` for removal. Core owns entry
  assignment, positioning, identity allocation, layout refresh, project revisions, compiler notifications, and history.
- Keep enable/disable actions, folding, and generic menu dispatch in editor-state.
- Use the existing menu registry and return explicit cleanup for each menu contribution and event handler.
- Keep tests focused on authoring against real core services. Install no sibling plugins to preserve fixtures.
- Keep spatial entry-assignment tests in editor-state; test the templates and menu coordinates forwarded to core here.
- Verify with Nx build, test, and typecheck. Composition screenshot coverage belongs to editor-default.
