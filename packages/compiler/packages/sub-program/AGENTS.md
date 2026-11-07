# Sub-program Package Guidelines

This file extends the root and `packages/compiler/AGENTS.md` guidance for
`packages/compiler/packages/sub-program`.

## Package Scope

- Package name: `@8f4e/sub-program`.
- Owns private orchestration of the global semantic, allocation, analysis, and code-generation passes that compile one
  composed validated-AST program into `CompiledSubProgram`.
- This package is an internal compiler stage. Consumers use `parseProjectSource` and `compileProject` from
  `@8f4e/compiler`; do not expose a parallel source input contract from this package.
- The input already contains all recursively composed source units. This package plans them together as one namespace and
  memory layout.
- Keep recursive traversal, source parsing, and symbol qualification in `@8f4e/program-composer`.
- Pass packages used exclusively by this pipeline live under `packages/`.
- Run `@8f4e/function-analyzer` after stack analysis and pass its per-function facts to codegen as output metadata.
  Keep optimization eligibility and transformations out of function analysis.
- When `inlineFunctions` is enabled, run `@8f4e/function-inliner` after function/assertion analysis and before final
  function layout. Pass its original-operation-indexed plans to codegen without changing analyzed source reports.

## Commands

- From the repository root, prefer Nx:
  - `npx nx run @8f4e/sub-program:build`
  - `npx nx run @8f4e/sub-program:typecheck`
  - `npx nx run @8f4e/sub-program:lint`
