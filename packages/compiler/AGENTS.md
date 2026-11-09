# Compiler Guidelines

## Ownership

- `@8f4e/compiler` is the public facade through `parseProjectSource` and `compileProject`.
- `@8f4e/language-spec` owns shared contracts and the canonical `ProjectObjectModel`.
- Project-preparser reads project source and prepares includes. Tokenizer validates syntax and builds ASTs.
  Program-composer traverses scopes, qualifies symbols and plans execution order.
- Sub-program orchestrates global semantic resolution, memory planning, stack analysis and code generation.
  Function-analyzer reports structural facts. Optimization passes choose policy. Wasm-ir-lowering expands
  resolved instructions into IR, and wasm-codegen assigns indices and emits the binary.
- Stdlib ships source functions. Include IDs are paths below `std/` without the source extension.

## Contracts and Tests

- Keep compiler stage dependencies external in library bundles so consumers share their error classes.
- Choose errors by detection phase. Use tokenizer's `SyntaxRulesError` and `SyntaxErrorCode` for token or
  argument shape. Use language-spec's `getError` and `ErrorCode` for semantic checks. Keep default messages
  in the central registries and add throw-site text for dynamic context.
- Downstream stages rely on tokenizer validation and semantic normalization. Keep diagnostics block-relative.
- Extend `tests/**/*.test.8f4e` for language and generated-program behavior and
  `tests/errors/**/*.error.8f4e` for diagnostics. Use TypeScript tests for host APIs, generated inputs and
  internals that source fixtures cannot exercise. Keep narrow stage tests with the owner.
- Enable threads for WABT inspection of shared-memory output. Update intentional fixture snapshots with
  `npx nx run @8f4e/compiler:test --update`.
