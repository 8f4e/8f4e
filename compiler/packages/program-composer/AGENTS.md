# Program Composer Guidelines

- Traverse the canonical project model, qualify symbols and produce the composed validated-AST program.
  Leave global semantic resolution, memory planning and emission to downstream stages.
- Treat nested projects as isolated namespaces. Expand child groups at their position in the typed execution
  sequence. Resolve entry dispatcher plans here for downstream consumers.
- Resolve `pass` after collecting declarations. Forward the parent's overload set or constant namespace
  while preserving the original function scope.
- Keep source-shaped integration fixtures and snapshots in `tests/`.
