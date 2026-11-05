# Project Preparser Package Guidelines

This file extends the root and compiler package guidance for `packages/compiler/packages/project-preparser`.

## Package Scope

- Package name: `@8f4e/project-preparser`.
- Source lives in `src/`; output lives in `dist/`.
- Owns parsing raw `.8f4e` project source into the compiler-owned `ProjectObjectModel` and resolving project includes
  for the compiler facade.
- Does not know about editor state, grid positioning, rendering, browser storage, or host webview state.
- Does not load include files itself. Callers provide an async `resolveInclude` function so node, browser, editor, and test environments can load includes however they need.
- Modules and groups share one typed `execution` sequence per scope. Preserve their relative declaration order and block ids.
- Groups recursively own project blocks. Sibling group names are unique because names form canonical compiler paths.

- Root and group scopes share an explicit local `entries` table, including empty entries. Group `main` joins the
  enclosing entry at the group's position; group `init` joins parent `init`. Other entries require local calls.
  Missing `main` is valid. Composition resolves dispatcher steps once; later stages consume those plans directly.

## Commands

- From the repo root, prefer Nx:
  - `npx nx run @8f4e/project-preparser:test`
  - `npx nx run @8f4e/project-preparser:typecheck`
  - `npx nx run @8f4e/project-preparser:lint`
  - `npx nx run @8f4e/project-preparser:build`
- The test target builds workspace dependencies before Vitest starts, so imports resolve to built package exports
  on a clean checkout without a separate build command.

## Architecture

- Pipeline: raw project source -> scope-local template source inlining -> classified `ProjectObjectModel` collections.
- `projectSource.ts` owns structural block boundaries, matching closers, and opaque note contents. Ordinary parsing,
  template transforms, and exported block validation share this reader. Preprocessors register additional scope
  delimiters explicitly; ordinary project-model construction does not know about template definitions.
- `parseProjectSource.ts` constructs the canonical model using explicit root/group/entry contexts. Keep source-line
  preservation and exposure collection separate from block-node dispatch and recursive scope traversal.
- `mapSourceScope` visits immediate nodes through entry wrappers without entering child-group scopes. Template
  transforms share this traversal while retaining their own validation, expansion, and precedence rules.
- Own `template` / `useTemplate` validation and inlining here before ordinary project parsing. Lookup uses the group's
  directly containing scope only. Retain `useTemplate` in group source, without template-specific model fields.
- Own inverse source extraction here; the save plugin calls it after ordinary serialization. The last group in source
  order wins silently per local template. Callers supply canonical order; this package never interprets editor positions.
  Reconstruct definitions from marked groups and omit unused definitions.
- `@8f4e/language-spec` is the sole owner of project object-model types; do not define parallel project contracts here.
- Do not lower a project into a second whole-project compiler input. Private compiler stages consume the canonical
  collections directly.
- Include source is resolved behind `compileProject` and passed to private compiler stages as derived functions.
- The tokenizer validates include binding names and include-local export syntax once during include preparation.
  Preserve function bodies as source text; the program composer applies final declaration and include-local call names to
  validated ASTs. Do not inspect project function declarations or allocate names to avoid public-name collisions here;
  ordinary namespace validation owns those checks.
- Keep compiler diagnostics block-relative. If project-level preparation reports an error from inside a block, attach the project block id and use the line number within that block.
