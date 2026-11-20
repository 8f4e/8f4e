# Project Preparser and Compiler Input Pipeline

Date: 2026-06-11

> Superseded on 2026-08-22 by the compiler-owned `ProjectObjectModel` design in TODO 477. This note is retained as
> historical context; `SubProgramSource` and the public preparation layer described below have been removed.

This note captures the intended architecture for turning 8f4e project source into the compiler's basic input blocks.

This plan is the reference for the project-preparser pipeline implementation and future cleanup around compiler input boundaries.

## Short version

The compiler should consume one normalized source object, `SubProgramSource`, made of the compiler's basic building blocks:

- executable module blocks grouped by entry name
- shared function blocks
- top-level constants blocks

Project-level conveniences such as includes are not basic compiler blocks. They should be reduced into function blocks before `SubProgramSource` reaches semantic analysis and code generation.

The project pipeline should have explicit layers:

```text
raw .8f4e project source
  -> project preparser
  -> project document / project blocks
  -> compiler input preparer
  -> SubProgramSource
  -> compiler semantic analysis and code generation
```

## Motivation

For file-oriented callers such as the CLI, examples, tests, and project imports, the natural input is a raw `.8f4e` project string.

For the editor, the natural input is lower in the pipeline. The editor already holds separated, editable code blocks. Re-serializing those blocks into a project string only to parse that string back into blocks would add avoidable work.

The project preparser should still be independent from the editor. Editor-state should map its own block representation into plain project blocks before calling shared preparation helpers. The shared preparser/preparer must not know about editor rendering fields, grid fields, selection state, or other editor-specific data.

Editor-state should also not own compiler-facing block classification. It can keep UI-facing block type information for rendering and interaction, but compilation should rely on the shared project-preparser to classify blocks as modules, functions, constants, includes, or ignored project blocks.

The architecture should therefore support both entry points:

```ts
const input = await prepareCompilerInputFromProjectSourceAsync(source, { resolveInclude });
```

and:

```ts
const input = await prepareCompilerInputFromProjectBlocksAsync(blocks, { resolveInclude });
```

Both paths should produce the same `SubProgramSource` shape.

## Layer ownership

### Project preparser

The project preparser owns raw project text grammar:

- project header validation
- entry blocks
- group blocks
- document/code block boundaries
- includes blocks as project blocks
- source line ids for diagnostics

The preparser should not load includes, resolve includes, or expand includes into functions.

Parsing should be environment-independent and synchronous unless another syntax feature truly requires async work.

Parsed project output should represent the project document. It should not contain include-expanded function blocks. Include blocks stay in the parsed project as normal project blocks; expanded include functions are produced later during compiler input preparation.

Groups are reserved for future project organization. They are intentionally not supported by the editor or compiler today. If the project preparser preserves group syntax, groups should remain part of the project document layer only and should not appear in `SubProgramSource`.

### Include resolver

Include loading belongs to the host environment.

Different environments can resolve the same include id differently:

- Node.js can load from `fs`.
- Browsers can lazy-load bundled source or fetch over the network.
- Tests can provide inline fixtures.
- The editor can provide virtual or user-local include sources.

The shared preparer layer should only accept a callback:

```ts
type IncludeResolver = (includeId: string) => string | Promise<string | undefined> | undefined;
```

It should not know where include source text comes from.

### Compiler input preparer

The compiler input preparer owns reduction from project blocks to `SubProgramSource`:

- classify plain project blocks into compiler block categories and project-only categories
- collect include declarations from includes blocks
- call the host-provided include resolver
- split resolved include source into function blocks
- attach source metadata to expanded include functions
- partition project blocks into entries, functions, and constants
- ignore non-compiler project blocks such as notes and editor-only blocks
- ignore groups as unsupported compiler input
- preserve source ids needed for diagnostics

This is the right place for async include resolution because includes are reducible project conveniences, not raw project syntax and not compiler semantic analysis.

Async include resolution should be the primary supported path. Synchronous include sources can still be returned by the resolver, but public preparation APIs should be async.

The preparer should preserve the order of project blocks it receives. For raw project source, this naturally means source order. For editor compilation, editor-state should sort blocks according to editor semantics, such as grid position, before mapping them to plain project blocks. The preparer should not know why a particular block order was chosen, and editor-state should not pre-classify blocks for compiler preparation.

Compiler diagnostics should use block-relative line numbers. Project-file or editor location mapping can be added around diagnostics by the caller, but compiler-facing line numbers remain relative to the block being compiled.

### Compiler

The compiler owns `SubProgramSource` and below:

- tokenizing individual compiler source blocks
- syntax validation within compiler blocks
- semantic analysis
- memory layout
- function and module compilation
- WebAssembly code generation

The compiler should not load project includes or understand includes blocks.

## Proposed public API shape

Names can still change, but the API should make the pipeline explicit:

```ts
parseProjectSource(source: string): ProjectDocument;

prepareCompilerInputAsync(
  project: ProjectDocument,
  options?: { resolveInclude?: IncludeResolver }
): Promise<SubProgramSource>;

prepareCompilerInputFromProjectSourceAsync(
  source: string,
  options?: { resolveInclude?: IncludeResolver }
): Promise<SubProgramSource>;
```

Editor-state can enter at the plain project-block layer after doing its own editor-specific ordering:

```ts
prepareCompilerInputFromProjectBlocksAsync(
  blocks: ProjectBlock[],
  options?: { resolveInclude?: IncludeResolver }
): Promise<SubProgramSource>;
```

Lower-level helpers should stay available for callers that intentionally assemble their own compiler input:

```ts
resolveFunctionIncludeSource(includeId, source);
resolveProjectIncludesAsync(includeBlocks, resolveInclude);
```

Direct compiler usage should also remain possible:

```ts
compile(input: SubProgramSource, options);
```

## Naming direction

Because the project has not been released yet, breaking API cleanup is acceptable. Prefer clean renames and removals over compatibility shims or transitional wrappers, and update all repository callers in the same refactor.

Potential renames:

- `ProjectInput` -> `ProjectDocument`
- `ProjectCodeBlock` -> `ProjectBlock`
- `ProjectCodeGroup` -> `ProjectGroup`
- `ProjectCompilerBlocks` -> remove, or replace with `SubProgramSource`
- editor-state `flattenProjectForCompiler` -> replace with shared preparer
- `@8f4e/tokenizer` project parsing surface -> move toward `@8f4e/project-preparser`

`SubProgramSource` is a good name and should stay. It already represents the compiler's basic source payload.

## Migration path

1. Add a shared compiler input preparer in `@8f4e/project-preparser`.
2. Make that preparer return the exact `SubProgramSource` type from `@8f4e/language-spec`.
3. Move include expansion out of `parse8f4eProject` and into the preparer.
4. Migrate CLI compilation to use the preparer instead of manually mapping `ProjectCompilerBlocks`.
5. Migrate editor-state compilation to map editor blocks into ordered plain project blocks, then use the same preparer instead of maintaining `flattenProjectForCompiler`.
6. Remove `includedFunctionBlocks` from parsed project output once all callers derive include functions during preparation.
7. Rename project parsing types to match the layer model.

## Open questions

None at the moment.
