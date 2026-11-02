# Program Composer Package Guidelines

This file extends the root and `packages/compiler/AGENTS.md` guidance for
`packages/compiler/packages/program-composer`.

## Package Scope

- Package name: `@8f4e/program-composer`.
- Own recursive `ProjectObjectModel` traversal, per-project cache namespaces, internal symbol qualification, and
  deterministic module execution order.
- Produce one composed validated-AST program for the compiler's global semantic, allocation, and code-generation pass.
- Keep the canonical source object model in `@8f4e/language-spec`; do not introduce another source representation.
- Keep memory planning, function/type indexing, semantic resolution, and WebAssembly emission outside this package.
- Nested projects are isolated namespaces. Consume typed `execution` nodes in order and expand child groups at their declaration positions.
- `pass NAME` explicitly forwards an immediate parent's function overload set or constant namespace. Resolve function
  passes after collecting declarations; keep calls bound to the original function scope without copying its body.
- Trust project structure and parsed metadata from upstream; keep syntax validation in the tokenizer and pass parsed data downstream.
- Keep source-shaped integration fixtures and their file snapshots under `tests/`; keep `src/` limited to package code.

- Root and group scopes share an explicit local `entries` table, including empty entries. Group `main` joins the
  enclosing entry at the group's position; group `init` joins parent `init`. Other entries require local calls.
  Missing `main` is valid. Composition resolves dispatcher steps once; later stages consume those plans directly.

## Commands

- From the repository root, prefer Nx:
  - `npx nx run @8f4e/program-composer:build`
  - `npx nx run @8f4e/program-composer:typecheck`
  - `npx nx run @8f4e/program-composer:test`
  - `npx nx run @8f4e/program-composer:lint`
