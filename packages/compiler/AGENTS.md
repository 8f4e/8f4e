# Compiler Guidelines

## Ownership

- `@8f4e/compiler` is the public facade through `parseProjectSource` and `compileProject`.
- `@8f4e/language-spec` owns shared contracts and the canonical `ProjectObjectModel`.
- Project-preparser reads project source and prepares includes. Tokenizer validates syntax and builds ASTs.
  Program-composer traverses scopes, qualifies symbols and plans execution order.
- Sub-program orchestrates global semantic resolution, memory planning, stack analysis and code generation.
  Wasm-ir-lowering builds the complete symbolic module. The inliner analyzes that module, and wasm-codegen
  assigns indices and emits the binary.
- Stdlib ships source functions. Include IDs are paths below `std/` without the source extension.

## Contracts and Tests

- Keep compiler stage dependencies external in library bundles so consumers share their error classes.
- Choose diagnostic domains by detection phase. Public tokenizer helpers return `SyntaxResult` failure data for
  token or argument shape. Use `syntaxErrorAt` or `getError` from `@8f4e/compiler-diagnostics` to construct a
  located `CompilerError`. Keep default wording in the syntax and semantic registries.
- Preserve each line's required `diagnosticSource` through compiler passes. Bind cached syntax to the current
  source without mutating the cache. Keep inherited declarations' original source and their shape site distinct.
- Downstream stages rely on tokenizer validation and semantic normalization. Keep diagnostics block-relative.
- Extend `tests/**/*.test.8f4e` for language and generated-program behavior and
  `tests/errors/**/*.error.8f4e` for diagnostics. Use TypeScript tests for host APIs, generated inputs and
  internals that source fixtures cannot exercise. Keep narrow stage tests with the owner.
- Enable threads for WABT inspection of shared-memory output. Update intentional fixture snapshots with
  `npx nx run @8f4e/compiler:test --update`.
