# Project Serialization

## Purpose

Shared conversion from live editor blocks to the canonical project model.

## Key Behaviors

- **Project Object Serialization**: `serializeToProject` converts editor code blocks to `ProjectObjectModel`
- **Consumers**: Compilation, undo/redo, session persistence, and optional file-export plugins
- **Pure Helpers**: No event handlers, subscriptions, or plugin installation

## Export

### Project Object Serialization (`serializeToProject`)

`serializeToProject` creates the compiler-owned `ProjectObjectModel` used for session saving, history, and live
compilation. It is not a separate editor schema and it is not the exported `.8f4e` file format.

Each known editor block is placed directly into the model's `execution`, `functions`, `constants`, `prototypes`,
`includes`, or `notes` collection. Incomplete blocks go to `unknown`; modules carry their required `entry`. Asset
directives remain embedded in block source. All notes belong to the project and are included in session saves,
history snapshots, and project files, regardless of their names.

### Ownership and Ordering

`serializeToProject(state)` and `serializeProjectLevel(level)` return detached project data. The latter requires a
complete `ProjectLevel`, keeping its blocks and entry definitions together, including empty entries. Every source
array is copied, including group wrappers, nested blocks, and project-scope code. Callers can retain or edit the
returned model without changing live editor state, and later live edits leave previously returned models unchanged.

Object fields are emitted in a fixed order. Blocks are ordered by grid X, grid Y, and creation index within each
project slice, recursively through nested groups. Equivalent live data therefore produces identical JSON regardless
of live-object property order or code-block array order. History and API-draft comparisons use this canonical output
directly with `JSON.stringify`.

### `.8f4e` Project Export

`serializeToProject(state)` collects the root code-block tree. The [project-save plugin](../../../../../../../plugins/project-save/README.md) owns the
private text formatter, Save/Export actions, keyboard shortcut, permissions, and browser writes. Open reads and parses
files; a shared per-editor file session holds the current handle and clears it on project replacement.

The [session persistence plugin](../../../../../../../plugins/session-persistence/README.md) saves the detached project model as JSON independently of file exports.
WebAssembly export belongs to `@8f4e/editor-plugin-wasm-export` and uses compiled bytes rather than source serialization.

### Export Naming

The separate [getExportBaseName](../getExportBaseName.ts) helper reads `export.fileName`, strips a recognized source
or WebAssembly extension, and defaults to `project`. [Filename configuration](../../features/editor-config/exportFileName.ts)
is registered independently of plugins so all export features can use the same configuration.

## State Sources

Serializes from:
- `state.codeBlockRendering.rootProject.blocks` - Blocks owned by the recursive root project level

## Integration Points

- **Edit History**: Retains detached serialized models directly as undo/redo snapshots
- **Project Loading**: Serialized projects are restored through the shared project operation helpers

## Project Object Model

The canonical structure is defined by `@8f4e/language-spec`:

Projects contain local `entries`, root-owned `code`, an ordered `execution` list of modules and groups, and separate
function,
constant, prototype, include, note, and unknown-block collections. Each group recursively owns the same project
structure plus its name, entry, source, and exposures. See the language-spec `ProjectObjectModel` definition for the
complete contract.

Collection membership defines block type. The adapter uses the editor's already-known block type and does not make the
compiler rediscover it from source text. Project groups are rendered as ordinary `CodeBlockGraphicData` values whose
optional `childProject` field owns a child `ProjectLevel`. Export recursively traverses its `blocks` and preserves
its `entries` from `rootProject`, regardless of which level `currentProject` references. Level paths and browser-memory viewport positions
are runtime data and are excluded from project exports, history snapshots, and session storage. A group's `code` retains all source lines
owned by its visible wrapper, including comments and editor directives, while its nested blocks stay in the recursive
collections. Compilation recursively composes those collections into one program.

## References

- [`serializeToProject.ts`](./serializeToProject.ts) - Session JSON structure serialization
- [Project Save plugin](../../../../../../../plugins/project-save/README.md) - `.8f4e` source formatting and writing
- [Project import](../../features/project-loading/README.md)

## Notes & Limitations

- Compiled data is excluded from history snapshots to save memory
- Binary assets are declared with `@config bin...` values and loaded by `@8f4e/editor-plugin-binary-assets`; exported projects do not embed binary payloads
