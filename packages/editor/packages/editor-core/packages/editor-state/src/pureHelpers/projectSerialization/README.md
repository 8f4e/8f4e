# Project Serialization

## Purpose

Shared conversion between live editor blocks, the canonical project model, and `.8f4e` source.

## Key Behaviors

- **Session Object Serialization**: `serializeToProject` converts editor code blocks to `ProjectObjectModel`
- **Consumers**: Compilation, undo/redo, session persistence, and optional file-export plugins
- **Source Serialization**: Formats the canonical project model as `.8f4e` text
- **Pure Helpers**: No event handlers, subscriptions, or plugin installation

## Export

### Session JSON Serialization (`serializeToProject`)

`serializeToProject` creates the compiler-owned `ProjectObjectModel` used for session saving, history, and live
compilation. It is not a separate editor schema and it is not the exported `.8f4e` file format.

Each known editor block is placed directly into the model's `modules`, `functions`, `constants`, `prototypes`,
`includes`, or `notes` collection. Incomplete blocks go to `unknown`; modules carry their required `entry`. Asset
directives remain embedded in block source. All notes belong to the project and are included in session saves,
history snapshots, and project files, regardless of their names.

### `.8f4e` Project Export

`serializeToProject(state)` collects the root code-block tree. `serializeProjectTo8f4e(project)` formats that
model as canonical source and rejects incomplete block syntax. Both helpers are public exports from editor-state.
The project-export plugin owns the file actions and shortcut; the browser host supplies file writing.

The [session persistence feature](../../features/session-persistence/effect.ts) uses these helpers and saves project
objects independently of file exports.
WebAssembly export belongs to `@8f4e/editor-plugin-wasm-export` and uses compiled bytes rather than source serialization.

### Export Naming

The separate [getExportBaseName](../getExportBaseName.ts) helper reads `export.fileName`, strips a recognized source
or WebAssembly extension, and defaults to `project`. [Filename configuration](../../features/editor-config/exportFileName.ts)
is registered independently of plugins so all export features can use the same configuration.

## State Sources

Serializes from:
- `state.codeBlockRendering.rootCodeBlocks` - Recursive root code-block tree

## Integration Points

- **Edit History**: Uses basic serialization for undo/redo snapshots
- **Project Import**: Exported projects are loaded through project import feature

## Project Object Model

The canonical structure is defined by `@8f4e/language-spec`:

```typescript
interface ProjectObjectModel {
	modules: ProjectModuleBlock[];
	functions: ProjectBlock[];
	constants: ProjectBlock[];
	prototypes: ProjectBlock[];
	includes: ProjectBlock[];
	notes: ProjectBlock[];
	unknown: ProjectBlock[];
	groups: ProjectGroupObjectModel[];
}

interface ProjectGroupObjectModel extends ProjectObjectModel {
	name: ProjectGroupName;
	entry: ProjectEntryName;
	code: string[];
	exposures: ProjectMemoryExposure[];
}
```

Collection membership defines block type. The adapter uses the editor's already-known block type and does not make the
compiler rediscover it from source text. Project groups are rendered as ordinary `CodeBlockGraphicData` values whose
optional `nestedProjectCodeBlocks` field owns the child project slice. Export recursively traverses that tree from
`rootCodeBlocks`, regardless of which slice `codeBlocks` currently points to. A group's `code` retains all source lines
owned by its visible wrapper, including comments and editor directives, while its nested blocks stay in the recursive
collections. Compilation recursively composes those collections into one program.

## References

- [`serializeToProject.ts`](./serializeToProject.ts) - Session JSON structure serialization
- [`serializeTo8f4e.ts`](./serializeTo8f4e.ts) - `.8f4e` file serialization
- [Project import](../../features/project-import/README.md)

## Notes & Limitations

- Compiled data is excluded from history snapshots to save memory
- Binary assets are declared with `@config bin...` values and loaded by `@8f4e/editor-plugin-binary-assets`; exported projects do not embed binary payloads
