# Project Serialization

## Purpose

Shared conversion from live editor blocks to the canonical project model.

## Key Behaviors

- **Project Object Serialization**: `serializeToProject` converts editor code blocks to `ProjectObjectModel`
- **Consumers**: Compilation, session persistence, and optional file-export plugins
- **Pure Helpers**: No event handlers, subscriptions, or plugin installation

## Export

### Project Object Serialization (`serializeToProject`)

`serializeToProject` creates the compiler-owned `ProjectObjectModel` used for session saving and live compilation.
It is not the editor's history snapshot or the exported `.8f4e` file format.

Each known editor block is placed directly into the model's `execution`, `functions`, `constants`,
`includes`, or `notes` collection. Incomplete blocks go to `unknown`; modules carry their required `entry`. Asset
directives remain embedded in block source. All notes belong to the project and are included in session saves and
project files, regardless of their names.

### Ownership and Ordering

`serializeToProject(state)` and `serializeProjectLevel(level)` return detached project data. The latter requires a
settled `ProjectLevel`, keeping its blocks and authoritative entry definitions together, including empty entries. Every source
array is copied, including group wrappers, nested blocks, and project-scope code. Callers can retain or edit the
returned model without changing live editor state, and later live edits leave previously returned models unchanged.

Object fields are emitted in a fixed order. Blocks are ordered by grid X, grid Y, and creation index within each
project slice, recursively through nested groups. Equivalent live data therefore produces identical JSON regardless
of live-object property order or code-block array order.

### `.8f4e` Project Export

`serializeToProject(state)` collects the root code-block tree. The [project-save plugin](../../../../../../../plugins/project-save/README.md) owns the
private text formatter, Save/Export actions, keyboard shortcut, permissions, and browser writes. Open reads and parses
files; a shared per-editor file session holds the current handle and clears it on project replacement.

The [session persistence plugin](../../../../../../../plugins/session-persistence/README.md) saves the detached project model as JSON independently of file exports.
WebAssembly export belongs to `@8f4e/editor-plugin-wasm-export` and uses compiled bytes rather than source serialization.

### Export Naming

The separate [getExportBaseName](../../editor-config/getExportBaseName.ts) helper reads `export.fileName`, strips a recognized source
or WebAssembly extension, and defaults to `project`. [Filename configuration](../../editor-config/exportFileName.ts)
is registered independently of plugins so all export features can use the same configuration.

## State Sources

Serializes from:
- `state.project.rootLevel.blocks` - Blocks owned by the recursive root project level

## Integration Points

- **Edit History**: Retains separate editor-owned source snapshots preserving draft metadata and block boundaries
- **Project Loading**: Loaded serialized projects are translated into the editor's source tree by the project transaction service

## Project Object Model

The canonical structure is defined by `@8f4e/language-spec`:

Projects contain local `entries`, root-owned `code`, an ordered `execution` list of modules and groups, and separate
function,
constant, include, note, and unknown-block collections. Each group recursively owns the same project
structure plus its name, entry, source, and exposures. See the language-spec `ProjectObjectModel` definition for the
complete contract.

Collection membership defines block type. The adapter uses the editor's already-known block type and does not make the
compiler rediscover it from source text. Project groups are rendered as ordinary `EditorCodeBlock` values whose
optional `childLevel` field owns a child `ProjectLevel`. Export recursively traverses its `blocks` and preserves
its `entries` from `rootLevel`, regardless of which level `activeLevel` references. Level paths and browser-memory viewport positions
are runtime data and are excluded from project exports and session storage. A group's `code` retains all source lines
owned by its visible wrapper, including comments and editor directives, while its nested blocks stay in the recursive
collections. Compilation recursively composes those collections into one program.

The editor's source pass records each group exposure's name, target, and zero-based row in the group's wrapper
`code`. Serialization copies those records without reparsing, and layout uses the same rows when following pending
edits. The rows match source parsing after child blocks are extracted; they are independent of the declaration's
original position in a whole `.8f4e` document. When rebuilding the source tree, the editor prepares exposure records
for every group, regardless of which view is open. Root serialization does not depend on a
group's source or layout being refreshed in the active view.

## References

- [`serializeToProject.ts`](./serializeToProject.ts) - Session JSON structure serialization
- [Project Save plugin](../../../../../../../plugins/project-save/README.md) - `.8f4e` source formatting and writing
- [Project import](../projectLoading.md)

## Notes & Limitations

- Compiled data is excluded from history snapshots to save memory
- Binary assets are declared with `@config bin...` values and loaded by `@8f4e/editor-plugin-binary-assets`; exported projects do not embed binary payloads
