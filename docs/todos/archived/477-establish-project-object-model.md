---
title: 'TODO: Establish compiler-owned ProjectObjectModel'
priority: High
effort: 1-2d
created: 2026-08-22
issue: null
status: Completed
completed: 2026-08-24
---

# TODO: Establish Compiler-Owned ProjectObjectModel

## Problem Description

8f4e projects currently cross the editor/compiler boundary through several similar but independently owned shapes.
`@8f4e/project-preparser` defines `ProjectDocument`, `ProjectBlock`, and `ProjectGroup`; `@8f4e/editor-state-types`
defines a separate `Project` and `CodeBlock`; and project preparation also exposes a bare project-block-array entry point.
The types happen to be structurally compatible in some call paths, but they do not describe one intentional contract.

This creates ambiguous ownership and permits fields to be silently added, omitted, or ignored. For example, preparser
projects carry block ids, disabled state, and groups while the editor's persisted project type only requires code blocks
and optional module entries. The editor therefore cannot point to one compiler-owned type as the definition of a
structured 8f4e project.

The editor naturally keeps project blocks as objects during live editing. Recompilation should consume that in-memory
object structure directly instead of serializing the entire project to `.8f4e` text and immediately parsing it again.
At the same time, `.8f4e` text should continue to parse into the same object representation used by the editor.

## Proposed Solution

Define and export a canonical `ProjectObjectModel` from `@8f4e/language-spec`. This compiler type package must be the
single source of truth for the structured representation of an 8f4e project. Define the supporting block, group,
entry, and identifier types beside it, with names and relationships chosen so invalid project structures are difficult
or impossible to construct accidentally.

Represent each block kind as its own top-level collection rather than storing a redundant type discriminator on every
block:

```ts
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

interface ProjectMemoryExposure {
	type: MemoryDeclarationInstruction;
	name: string;
	targetModuleName: string;
	targetMemoryName: string;
}

interface ProjectBlock {
	id: ProjectBlockId;
	code: string[];
	disabled?: boolean;
}

interface ProjectModuleBlock extends ProjectBlock {
	entry: ProjectEntryName;
}
```

Collection membership is the block type. The model must not also carry `type: 'function' | 'module' | ...`, because
the field and collection could disagree. `modules` preserves module order; filtering that array by `entry` defines the
execution order for each entry. Functions, constants, and prototypes are hoisted, so their array order is deterministic
but not semantically significant. Includes retain array order for deterministic expansion. Notes and unknown/incomplete
blocks remain available to editors without entering compilation.

Groups use the same object model recursively rather than referencing root-owned blocks by id. A nested model owns its
modules, functions, constants, prototypes, includes, notes, unknown blocks, and further groups. Identity fields are not
part of the root project model: child groups require a sibling-unique `name` and an `entry` through
`ProjectGroupObjectModel`. Its `code` retains every source line owned by the group wrapper, while nested project blocks
remain in their typed collections. A group's canonical path is formed from its ancestors' encoded names. The root path
is empty, so module identities are readable and deterministic: `counter`, `audio/counter`, and
`audio/voices/counter`. The same identity keys `compiledModules`, `memoryPlan.modules`,
`memoryDefaultsByModuleId`, and `pointerMetadataByModuleId` without a transformed result map. The compiler recursively
parses and isolates these models before flattening them into one globally planned program; it does not merge
independently compiled WebAssembly artifacts.

Each group may expose memory from one of its direct modules to its enclosing project. The object model stores these
ordered aliases in `ProjectGroupObjectModel.exposures`; `.8f4e` text writes them as
`expose <name> &<module>:<memory>`. An exposure is non-allocating. The alias table resolves a reference to the public
group name to the canonical backing module and memory name. The backing declaration supplies the type for compiler
resolution, editor controls, and connector direction.
The compiled result indexes resolved exposures by canonical group path and points directly to each backing
`PlannedMemoryDeclaration`.

Source-level module names match `[A-Za-z_][A-Za-z0-9_-]*`. This keeps the module-name leaf safe to use verbatim in a
canonical module id; only group-name path segments require encoding.

The editor mirrors this recursive ownership without introducing another project schema. A project group is represented
by the same `CodeBlockGraphicData` used for other visible blocks, with `nestedProjectCodeBlocks` pointing to the child
project's code-block array. `rootCodeBlocks` owns the recursive editor tree, while the existing `codeBlocks` field points
directly to the one project slice currently rendered. Project-owned arrays keep stable identity and editor operations
replace their contents in place; loading a project rebuilds the tree and resets the rendered pointer to the root.
Every generic code block stores only its owning `projectPath`. Module-specific consumers derive a module id from that
path and the block name at the compiler lookup boundary; `CodeBlockGraphicData` does not carry a module-only identity.

Make both project input paths converge on that contract:

```text
.8f4e text ---- parseProjectSource ----\
                                        ProjectObjectModel ---- compileProject ---- compiled result
editor state -- direct object adapter -/
```

Expose only `parseProjectSource` and `compileProject` as the project-facing compiler operations. `parseProjectSource`
classifies textual blocks into the appropriate collections. Editors already know the type of each live block and must
place it into the appropriate collection when constructing the object model. `compileProject` consumes those
collections directly; it must not re-read source markers to rediscover types or convert the project into a parallel
whole-project structure that encodes the same classification again.

This work defines a TypeScript object model only. It does not introduce a JSON Schema, a `.8f4e.json` format, or a
requirement to persist projects as JSON. `.8f4e` remains the textual project representation and one adapter into the
object model.

## Anti-Patterns

- Do not define `ProjectObjectModel` in editor-state or project-preparser and re-export it through compiler packages.
- Do not retain structurally similar `Project`, `ProjectDocument`, or project-block contracts in multiple packages.
- Do not make recompilation serialize editor state to complete `.8f4e` text before preparing compiler input.
- Do not add an overloaded compiler API accepting `string | ProjectObjectModel | ProjectBlock[]`.
- Do not expose bare project-block arrays as an alternative public project representation.
- Do not add a per-block `type` discriminator when collection membership already defines the block type.
- Do not add entity-specific fields such as `moduleId` to the editor's generic code-block representation.
- Do not flatten recursively owned group blocks back into the root collections.
- Do not make the compiler classify object-model blocks by inspecting their source markers.
- Do not convert `ProjectObjectModel` into `SubProgramSource` or another parallel whole-project decomposition before
  compilation; compiler stages should consume the canonical collections directly.
- Do not introduce JSON validation, JSON Schema generation, a new project filename extension, or persistence migration
  work as part of this cleanup.
- Do not keep compatibility aliases, deprecated overloads, or migration shims. The project is unreleased, so update all
  consumers directly and delete the superseded contracts.

## Implementation Plan

### Step 1: Design The Canonical Object Model

- Add `ProjectObjectModel` and its supporting types to `@8f4e/language-spec`.
- Store modules, functions, constants, prototypes, includes, notes, and unknown blocks in separate top-level arrays;
  collection membership defines block type.
- Require `entry` on module blocks and do not permit it on the shared base block type.
- Preserve module order in the `modules` array and document that functions, constants, and prototypes are hoisted.
- Represent groups as recursively owned `ProjectGroupObjectModel` values so every block is owned by exactly one
  project model and every child has a required name and entry.
- Keep recursive compilation out of the group-model refactor; compile only the root project until a dedicated
  composition step merges independently compiled sub-programs.
- Define project block ids as persistent project identities and use the same type for editor identity and compiler
  diagnostic mapping.
- Treat project collections as caller-owned input; compiler stages must not mutate them.

### Step 2: Move Project Type Ownership To Language Spec

- Replace project-preparser's `ProjectDocument`, `ProjectBlock`, and `ProjectGroup` definitions with imports from
  `@8f4e/language-spec`.
- Replace editor-state-types' independent `Project` and persistent `CodeBlock` project contracts with the canonical
  compiler-owned types or narrowly named editor-runtime types where additional transient state is genuinely required.
- Export the new object-model types from the public `@8f4e/language-spec` entry point.
- Remove obsolete type exports and update repository imports without compatibility aliases.

### Step 3: Expose The Two-Function Project Compiler API

- Make `parseProjectSource(text)` return `ProjectObjectModel`.
- Add asynchronous `compileProject(project, options)` as the only public compilation entry point, accepting a complete
  `ProjectObjectModel` and returning `CompileResult`.
- Remove `prepareCompilerInputAsync`, `prepareCompilerInputFromProjectBlocksAsync`, and
  `prepareCompilerInputFromProjectSourceAsync` from consumer-facing exports.
- Remove `SubProgramSource` and the public `compile(SubProgramSource, ...)` entry point. Update compiler stages to read
  the canonical module, function, constants, and prototype collections directly.
- Resolve includes as compiler-derived function sources without constructing a second project-level input model.
- Keep include resolution explicit in `compileProject` options, make the public function asynchronous, and preserve
  block-relative diagnostic identity.

### Step 4: Make The Editor Produce ProjectObjectModel Directly

- Update editor project loading, import, export, session persistence, edit history, and compilation code to use the
  compiler-owned object model.
- Convert live editor state to `ProjectObjectModel` through an object-to-object adapter without generating `.8f4e`
  text.
- Make the editor adapter place each known block into its corresponding collection and place incomplete or mixed blocks
  into `unknown`; this classification is an editor responsibility, not compiler preparation.
- When an edit changes a block kind, move the block between collections while preserving its id.
- Send `ProjectObjectModel` across the compiler-worker boundary; do not make the editor lower projects for the worker.
- Preserve editor-only runtime and rendering state outside the compiler-owned project model unless it is part of the
  actual 8f4e project representation.
- Store the generic owning project path on editor code blocks and derive module ids only in module-specific consumers.
- Ensure `.8f4e` imports and direct editor-created projects reach the same project preparation path.

### Step 5: Consolidate Tests And Documentation

- Add language-spec compile-time contract coverage for the canonical project model.
- Update project parser and compiler tests to assert that text parsing and direct object construction produce
  equivalent `ProjectObjectModel` values and compiled output.
- Update editor compiler tests to pass the complete object model rather than a bare block array or lowered compiler
  input.
- Add integration coverage proving that an imported `.8f4e` project and the equivalent editor-created object compile to
  equivalent WebAssembly output.
- Update compiler/editor package documentation and relevant `AGENTS.md` architecture notes to identify
  `@8f4e/language-spec` as the sole owner of the object model.

## Validation Checkpoints

- `rg -n "interface (Project|ProjectDocument|ProjectBlock|ProjectGroup)|prepareCompilerInput|SubProgramSource" packages/editor src`
- `npx nx run @8f4e/language-spec:test`
- `npx nx run @8f4e/language-spec:typecheck`
- `npx nx run @8f4e/project-preparser:test`
- `npx nx run @8f4e/project-preparser:typecheck`
- `npx nx run @8f4e/editor-state-types:typecheck`
- `npx nx run @8f4e/editor-state:test`
- `npx nx run @8f4e/editor-state:typecheck`
- `npx nx run @8f4e/compiler:test`
- `npx nx run @8f4e/compiler:typecheck`
- `npx nx run @8f4e/editor-website:build`

## Success Criteria

- [x] `ProjectObjectModel` and all shared project structure types are defined and publicly exported only by
  `@8f4e/language-spec`.
- [x] `.8f4e` text parsing returns `ProjectObjectModel`.
- [x] The editor constructs and passes `ProjectObjectModel` without whole-project text serialization during live
  recompilation.
- [x] The public compiler API exposes `parseProjectSource` and asynchronous `compileProject` as its two project
  operations.
- [x] Block type is represented solely by top-level collection membership; object-model blocks do not carry a redundant
  type field.
- [x] Module order is preserved per entry, while functions, constants, and prototypes are compiled as hoisted blocks.
- [x] Groups recursively own complete `ProjectObjectModel` values instead of referencing root blocks by id.
- [x] Groups expose direct-module memory through non-allocating symbolic aliases and compiled address metadata.
- [x] Canonical group paths derive from sibling-unique group names and key every module-addressed compiler result map.
- [x] The initial object-model refactor left recursive compilation out of scope; follow-up composition now compiles all
  recursively owned groups before one global allocation and code-generation pass.
- [x] The editor mirrors group ownership with recursively nested code-block arrays, initially renders the root slice,
  and can move into child slices or back to their parent from context menus.
- [x] Compiler stages consume the canonical typed collections directly; `SubProgramSource` and whole-project
  preparation are removed.
- [x] Bare project-block arrays and duplicate editor/preparser project contracts are removed from public APIs.
- [x] `ProjectObjectModel` remains distinct from editor runtime/rendering state and private lowered compiler state.
- [x] No JSON Schema, `.8f4e.json` format, or compatibility layer is introduced.
- [x] Equivalent text-parsed and directly constructed projects produce equivalent compiler input and compiled output.
- [x] Relevant package tests, typechecks, and the root application build pass.

## Affected Components

- `packages/compiler/packages/language-spec` - own and export `ProjectObjectModel` and supporting types.
- `packages/compiler/packages/project-preparser` - classify text blocks into the canonical model collections.
- `packages/compiler/packages/sub-program` - compile canonical project collections directly.
- `packages/compiler` - expose only project parsing and compilation to project-facing consumers.
- `packages/editor/packages/editor-core/packages/editor-state-types` - remove duplicate persistent project contracts and distinguish runtime
  editor state from the canonical model.
- `packages/editor/packages/editor-core/packages/editor-state` - use the canonical model for import, export, history, persistence, and live
  compilation.
- `src/compiler-callback.ts` and `src/storage-callbacks.ts` - update root application boundaries to the unified types.
- `src/__tests__/exampleProjects.test.ts` - verify text and object paths converge before compilation.

## Risks & Considerations

- **Category transitions**: Editors must move a block between collections when editing changes its kind while preserving
  its stable id and module entry where applicable.
- **Module order**: Only module order is semantically significant. The implementation must preserve order within each
  entry without inventing global ordering requirements for hoisted blocks.
- **Group behavior**: Nested projects own their blocks structurally. The compiler composer visits every owned project
  exactly once, isolates nested symbols with their canonical group path, and places child modules before parent
  modules. Editor project-slice arrays retain stable identity so direct root/current pointers cannot be invalidated by
  add, delete, paste, or reorder operations.
- **Editor metadata ownership**: Grid position, selection, cursor, rendering caches, and transient creation state must
  not leak into the compiler-owned model merely because the editor currently stores them beside source blocks.
- **Diagnostic mapping**: Changes to block identity must preserve reliable mapping from compiler diagnostics back to
  live editor blocks.
- **Incremental compilation**: Preserve compiler cache reuse by passing stable block code arrays and identities where
  appropriate; do not introduce whole-project conversion work on every edit.
- **Worker include resolution**: Functions cannot cross `postMessage`; resolve include sources through the browser host
  before posting or use worker request/response plumbing without exposing private lowering to the editor.
- **Breaking changes**: This is intentionally a direct pre-release API replacement. Update all repository consumers in
  one change and remove old names and entry points.

## Related Items

- **Related**: `docs/todos/archived/446-store-project-block-type-during-project-parse.md`
- **Related**: `docs/todos/archived/310-simplify-compiler-project-flattening-and-compilable-block-checks.md`
- **Related**: `docs/todos/archived/391-add-compiler-ast-cache.md`

## Notes

- `ProjectObjectModel` names the canonical in-memory TypeScript representation; it does not imply a serialized object
  file format.
- The package name already provides the 8f4e namespace, avoiding invalid or awkward TypeScript identifiers such as
  `8f4eProjectObjectModel` or `_8f4eProjectObjectModel`.
