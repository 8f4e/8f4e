# Code-block copy and paste

- Own block copy/paste menu actions and clipboard format handling here. Inject read/write functions through `createCodeBlockCopyPastePlugin`; shared plugin context and core contain no browser clipboard service.
- Use pure `serializeCodeBlocks` and generic `insertCodeBlocks` from editor-state. Pasting changes only `@pos` for menu-location placement. Preserve all names, references, grouping directives, nested project trees and entry tables without numbering or transform hooks.
- Ordinary copies are plain source; nested/group batches use serialized JSON arrays. Keep text pasting inside keyboard-editing independent of this plugin.
- Own explicit menu/listener disposal. Test this plugin against core services; do not install sibling plugins to preserve fixtures. Native composed behavior belongs in editor-default tests.
- Run the build, test and typecheck Nx targets for this package.
