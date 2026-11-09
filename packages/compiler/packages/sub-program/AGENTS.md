# Sub-program Guidelines

- Compile one composed validated-AST program as a single namespace and memory layout. Keep traversal, parsing
  and qualification upstream in program-composer.
- Keep passes used only by this pipeline in its nested `packages/`.
- Derive function facts, assertions and lowered bodies from source stack analysis. Inline lowered bodies before
  assigning indices. Preserve source analysis and stack metadata in compiled results.
