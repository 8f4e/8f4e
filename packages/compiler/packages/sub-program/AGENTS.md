# Sub-program Guidelines

- Compile one composed validated-AST program as a single namespace and memory layout. Keep traversal, parsing
  and qualification upstream in program-composer.
- Keep passes used only by this pipeline in its nested `packages/`.
- Plan assertions and lower the complete module before optimization. Assemble the compiler result from the emitted
  binary and the source metadata and stack analysis collected alongside the IR.
