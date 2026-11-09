# Project Preparser Guidelines

- Read raw project source into language-spec's canonical model, preserving block IDs, source lines, local entry
  tables and module/group declaration order. Callers provide asynchronous include resolution.
- Keep block boundaries, matching closers and opaque notes in the shared structural source reader. Share it
  across parsing, template transforms and exported block validation.
- Expand and validate templates before ordinary parsing. Own inverse extraction for project saving here.
  Keep template transforms scope-local and source-based. The caller supplies canonical source order.
- Validate include-local bindings through tokenizer. Preserve function bodies as source for program-composer
  to apply final names. Ordinary namespace validation handles collisions.
