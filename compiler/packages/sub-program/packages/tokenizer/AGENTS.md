# Tokenizer Guidelines

- Own source-to-AST parsing and validation that can be decided from tokens or argument shape. Compiler semantic
  stages own checks that require symbols, scopes, stack state or types.
- Keep syntax diagnostics in `src/syntax/syntaxError.ts`.
- Colocate narrow utility tests with their source. Put public parser and multi-module tests in `tests/`, with
  snapshots and fixtures under that directory.
