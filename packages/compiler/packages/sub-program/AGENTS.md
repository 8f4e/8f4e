# Sub-program Guidelines

- Compile one composed validated-AST program as a single namespace and memory layout. Keep traversal, parsing
  and qualification upstream in program-composer.
- Keep passes used only by this pipeline in its nested `packages/`.
- Plan assertions and lower the complete module before inlining. Keep source metadata and stack analysis alongside
  the IR. Assemble the compiler result using the emitted bodies and indices.
