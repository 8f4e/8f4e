# @8f4e/project-preparser

`@8f4e/project-preparser` parses `.8f4e` project documents into the canonical compiler-owned object model.

Template inlining happens on the parsed source tree before construction of the project model. The package-level flow is:

```ts
const project: ProjectObjectModel = parseProjectSource(sourceText);
```

It understands document delimiters, entries, recursively owned groups, group memory exposures, disabled blocks, and
block markers. Parsing classifies blocks once: modules and groups become typed nodes in the shared `execution` sequence,
while hoisted declarations and non-executable blocks retain their own collections. Each scope preserves relative
module/group declaration order and source block ids. The model is defined only by `@8f4e/language-spec`.

Disabled block metadata comes from the same directive-comment scanner used by editor source handling.
Valid standalone, chained, and trailing `@disabled` directives set the block's disabled flag,
while ordinary comment prose and function documentation do not.

Note blocks (`note` through `noteEnd`) preserve their content as text until the closing `noteEnd`.
Lines that look like other block markers remain note content at the project root and inside groups.

`projectSource.ts` supplies the shared structural reader for ordinary parsing, source template transforms, and
`validateProjectCodeBlock`, which validates model-owned flat blocks before serialization and group shells during
composition. Nested blocks remain separately owned in the model. The reader preserves original line numbers,
parses each group header once, classifies group-body declarations, and treats document blocks as opaque; notes
can contain examples of arbitrary markers. Flat group validation returns the classified declaration keywords and
their zero-based wrapper rows for composition.
Preprocessors register their additional scope delimiters explicitly. Template transforms also share `mapSourceScope`,
which follows entry wrappers within one owning scope and leaves child-group recursion to the caller.

Model construction in `parseProjectSource.ts` traverses those source nodes with explicit root, group, and entry
contexts. Copied template blocks receive distinct IDs based on expanded source order, while diagnostics retain the
original document rows. Source-line preservation and exposure collection are handled separately from block classification and
recursive entry/group traversal. Each context writes directly into the canonical project model.

`validateUniqueSiblingGroupNames` checks authored project models recursively before compilation or file export.
Unlike a document parse failure, it reports a duplicate at the owning group block and wrapper row.

This package owns:

- Inlining group-scoped source templates and extracting them from expanded serialized source.
- Parsing the expanded project source into `ProjectObjectModel` collections and groups.
- Classifying project document blocks.
- Preserving entry membership for module and group nodes.
- Preserving group-level `pass <namespace>` declarations for the program composer, and rejecting standalone root declarations.
- Preserving group-level `init` declarations for syntax validation and scoped composition.
- Parsing `expose <name> &<module>:<memory>` declarations owned by groups.
- Parsing and resolving include declarations for the public compiler facade.

This package does not own:

- Loading include files from disk, the network, editor state, or any other environment.
- Tokenizing compiler source blocks into ASTs.
- Constant resolution, memory planning, stack analysis, or code generation.
- Editor layout, rendering, storage, or host webview state.

Groups recursively own their project blocks. Their memory exposure declarations remain symbolic project metadata;
the program composer resolves those aliases before the compiler's single global memory-planning pass. Each exposure
records a zero-based `lineNumber` in its owning group's `code`. The parser records that row while collecting the
declaration, after nested blocks have been extracted; document line numbers are used separately for parsing errors.

Include declarations use `include <path> [exportedName [localName]]`: omit the name to expose all public exports,
select an exported name to expose its overload family, or add a local name to rename that selection. Repeated selections
are merged per source, with one local name per export. Conflicting selections of one export under different local names
are rejected. The program composer applies final declaration names and include-local call targets to validated ASTs.
Later compiler passes receive ordinary functions. Include-specific internal names use `nonexported` for functions without
an export marker and `unselected` for exports that were not selected. Collisions with project declarations are handled by
ordinary namespace validation.

Library files can declare dependencies using their own `includes` blocks. The resolver loads each file once
within a project scope and gives dependencies private function identities shared by all importers in that scope.
Direct project imports have separate bindings, so a project rename or local override cannot change an imported
library's dependency. Missing files and cycles retain the importing file's row and the originating project include.

Include export and binding failures retain the included file id and the declaration that loaded the file, including
its project group. The program composer uses the parsed `call` instructions to check for ambiguous or unbound targets.
Include failures use named `IncludeErrorCode` values, and all stored include rows are zero-based. Their messages
describe the failure while hosts format the supplied source coordinates.

## Group source templates

`parseProjectSource` expands templates directly on the structural source nodes. Definitions use `template NAME` / `templateEnd`;
a child group selects a definition with the opener `group INSTANCE use NAME`. Lookup uses only the directly containing scope.
Definitions can appear after their users. A raw using group may contain its own declaration lines, but no child blocks
or entries. The inlining stage validates these rules and removes definitions, retaining the original group header.
The model contains independent, fully expanded groups and no template registry.

`extractProjectTemplates(expandedSource)` is the inverse source transform used after ordinary editor serialization.
Within each scope, the last using group in source order supplies the shared child blocks and entries. Editor serialization
already uses spatial order, so the rightmost instance wins, with existing vertical/creation tie breakers. The transform
silently replaces other copies, preserves each outer shell, reconstructs nested definitions in their owning scopes, and
omits unused definitions. Appending `use NAME` to an existing editor group's opener creates the definition on save.

These transforms do not read editor positions or state. See [source syntax](../../docs/source-syntax.md#group-templates)
for the language and authoring behavior.
