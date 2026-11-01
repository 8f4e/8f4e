# Compiler Package Guidelines

This file extends the repository-level guidance for `packages/compiler`.

## Scope and Architecture

- `@8f4e/compiler` is the public facade. Use `parseProjectSource(text)` and asynchronous
  `compileProject(project, options)` rather than exposing internal pipeline inputs.
- `@8f4e/language-spec` owns shared contracts, `ProjectObjectModel`, and semantic compiler errors.
- `@8f4e/project-preparser` parses project source and resolves included functions.
- `@8f4e/program-composer` parses blocks, traverses recursive groups, qualifies symbols, and establishes deterministic
  module order. Modules and groups share the ordered `execution` sequence; child groups expand at their declaration positions.
- `@8f4e/tokenizer` owns syntax parsing and validation.
- `@8f4e/sub-program` orchestrates semantic resolution, memory planning, stack analysis, and compilation.
- `@8f4e/wasm-codegen` generates function and module bodies and emits the final WebAssembly binary.
- `@8f4e/stdlib` contains source-only standard-library functions. Include IDs are paths under `std/` without `.8f4e`.

- Root and group scopes share an explicit local `entries` table, including empty entries. Group `main` joins the
  enclosing entry at the group's position; group `init` joins parent `init`. Other entries require local calls.
  Missing `main` is valid. Composition resolves dispatcher steps once; later stages consume those plans directly.

## Commands and Style

- Keep compiler stage dependencies external in library bundles so consumers share their implementations and error classes.
- Use Nx from the repository root: `npx nx run @8f4e/compiler:build|test|typecheck|lint`.
- TypeScript is strict. Use Biome for formatting, linting, and import organization.
- Update intentional snapshots with `npx nx run @8f4e/compiler:test --update`.

## Testing

- Default to extending the relevant `tests/**/*.test.8f4e` fixture for language behavior, compiler regressions,
  semantic behavior, and generated-program behavior. These fixtures run native assertions and capture compile-result
  snapshots.
- Use `tests/errors/**/*.error.8f4e` for compilation failures and diagnostic snapshots.
- Use TypeScript tests only when coverage requires a programmatic API, JavaScript host callback, cache or mutation
  behavior, generated stress input, fixture infrastructure, or direct inspection of an internal stage.
- Keep narrow stage unit tests beside the owning source. Syntax and parser tests belong to `@8f4e/tokenizer`.

## Error Domains

Choose errors by detection phase:

- Use `SyntaxRulesError` and `SyntaxErrorCode` from `@8f4e/tokenizer` when token or argument shape is sufficient.
- Use `getError` and `ErrorCode` from `@8f4e/language-spec` when detection needs symbols, scope, memory, stack, types,
  or other compiler state.
- Default messages belong in the central registry. Add a throw-site message only for useful dynamic context.

## Internal Contracts

Tokenizer validation and semantic normalization establish internal invariants. Downstream stages should trust those
invariants and use static types and tests instead of repeating defensive argument-shape checks.
