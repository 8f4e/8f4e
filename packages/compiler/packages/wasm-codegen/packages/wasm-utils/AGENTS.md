# Wasm Utilities Guidelines

- Keep this package focused on deterministic byte encoding and instruction and section builders. Compiler
  stages supply semantic decisions.
- Colocate narrow encoder tests with their source. Put cross-module tests and fixtures in `tests/`.
