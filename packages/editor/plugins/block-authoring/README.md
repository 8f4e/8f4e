# Block authoring

`blockAuthoringPlugin` contributes New Module, New Function, New Prototype, and New Note to the main menu, plus
Delete to a block's menu. Menu contributions and commands are available in edit mode.

`createCodeBlock { x, y, blockType }` creates a four-line source template. Named block types use a random particle
name; notes start unnamed. Names are not made unique. The command dispatches core's generic `insertCodeBlock`,
which places the source at the requested viewport coordinates and assigns module entry membership.

`deleteCodeBlock { codeBlock }` removes the requested block through core's shared `deleteCodeBlocks` helper.
Core owns references, revisions, history, compiler notifications, and generic insertion/removal semantics.

The plugin uses no browser APIs. Disposal unregisters its menu items and action handlers.

Run the package's Nx build, test, and typecheck targets. Tests use real core services for menu activation,
templates, duplicate names, entry delegation, source revisions, deletion/history, mode policy, and disposal.
